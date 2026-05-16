import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { BOOKING_LOCK_TTL_MINUTES } from "@/features/bookings/server/lock/constants";
import type { Database, PaymentStatus } from "@/lib/database/types";
import {
  PENDING_PAYMENT_EXPIRE_BATCH_SIZE,
  PENDING_PAYMENT_EXPIRY_GRACE_MINUTES,
} from "./constants";

const serviceActor = { actorType: "service" as const, profileId: null };

const STALE_PAYMENT_STATUSES: PaymentStatus[] = ["initialized", "pending"];

export type ExpirePendingPaymentsSkipped = {
  paid: number;
  notYetDue: number;
  wrongBookingStatus: number;
  alreadyFailed: number;
  commandRejected: number;
};

export type ExpirePendingPaymentsError = {
  paymentId: string;
  bookingId: string;
  code: string;
  message: string;
};

export type ExpirePendingPaymentsResult = {
  scanned: number;
  expired: number;
  skipped: ExpirePendingPaymentsSkipped;
  errors: ExpirePendingPaymentsError[];
};

type StalePaymentRow = {
  id: string;
  booking_id: string;
  status: PaymentStatus;
  payment_link_expires_at: string | null;
  created_at: string;
};

export function isStalePendingPayment(
  payment: Pick<StalePaymentRow, "payment_link_expires_at" | "created_at">,
  now: Date,
  graceMinutes: number = PENDING_PAYMENT_EXPIRY_GRACE_MINUTES,
): boolean {
  const graceMs = graceMinutes * 60_000;
  const fallbackMs = (BOOKING_LOCK_TTL_MINUTES + graceMinutes) * 60_000;
  const nowMs = now.getTime();

  if (payment.payment_link_expires_at) {
    const expiresMs = new Date(payment.payment_link_expires_at).getTime();
    return nowMs > expiresMs + graceMs;
  }

  const createdMs = new Date(payment.created_at).getTime();
  return nowMs > createdMs + fallbackMs;
}

/**
 * Expires abandoned Paystack checkouts via `MARK_PAYMENT_FAILED` (checkout_expired).
 * Read-only candidate query + command layer per row; idempotent cron keys.
 */
export async function expireStalePendingPayments(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend = createBookingCommandBackend(),
  options: {
    now?: Date;
    batchSize?: number;
    graceMinutes?: number;
  } = {},
): Promise<ExpirePendingPaymentsResult> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? PENDING_PAYMENT_EXPIRE_BATCH_SIZE;
  const graceMinutes = options.graceMinutes ?? PENDING_PAYMENT_EXPIRY_GRACE_MINUTES;
  const graceMs = graceMinutes * 60_000;
  const fallbackMs = (BOOKING_LOCK_TTL_MINUTES + graceMinutes) * 60_000;

  const linkExpiryCutoff = new Date(now.getTime() - graceMs).toISOString();
  const fallbackCreatedCutoff = new Date(now.getTime() - fallbackMs).toISOString();

  const { data: paymentRows, error } = await client
    .from("payments")
    .select("id, booking_id, status, payment_link_expires_at, created_at")
    .in("status", STALE_PAYMENT_STATUSES)
    .or(
      `payment_link_expires_at.lt.${linkExpiryCutoff},and(payment_link_expires_at.is.null,created_at.lt.${fallbackCreatedCutoff})`,
    )
    .order("payment_link_expires_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error) throw new Error(error.message);

  const stalePayments = (paymentRows ?? []) as StalePaymentRow[];
  const bookingIds = [...new Set(stalePayments.map((p) => p.booking_id))];
  const bookingStatusById = new Map<string, string>();

  if (bookingIds.length > 0) {
    const { data: bookings, error: bookingError } = await client
      .from("bookings")
      .select("id, status")
      .in("id", bookingIds);

    if (bookingError) throw new Error(bookingError.message);
    for (const booking of bookings ?? []) {
      bookingStatusById.set(booking.id, booking.status);
    }
  }

  const candidates = stalePayments.filter(
    (p) => bookingStatusById.get(p.booking_id) === "pending_payment",
  );
  const result: ExpirePendingPaymentsResult = {
    scanned: candidates.length,
    expired: 0,
    skipped: {
      paid: 0,
      notYetDue: 0,
      wrongBookingStatus: 0,
      alreadyFailed: 0,
      commandRejected: 0,
    },
    errors: [],
  };

  for (const payment of candidates) {
    const bookingStatus = bookingStatusById.get(payment.booking_id);

    if (payment.status === "paid") {
      result.skipped.paid += 1;
      continue;
    }
    if (payment.status === "failed" || payment.status === "refunded") {
      result.skipped.alreadyFailed += 1;
      continue;
    }
    if (bookingStatus !== "pending_payment") {
      result.skipped.wrongBookingStatus += 1;
      continue;
    }
    if (!isStalePendingPayment(payment, now, graceMinutes)) {
      result.skipped.notYetDue += 1;
      continue;
    }

    const cmdResult = await executeBookingCommand(
      backend,
      {
        type: "MARK_PAYMENT_FAILED",
        actor: serviceActor,
        bookingId: payment.booking_id,
        paymentId: payment.id,
        idempotencyKey: `cron:expire-pending-payment:${payment.id}`,
        reason: "Checkout expired without payment",
        metadata: {
          failure_reason: "checkout_expired",
          source: "expire_pending_payment_cron",
          expired_at: now.toISOString(),
          payment_link_expires_at: payment.payment_link_expires_at,
        },
      },
      {},
    );

    if (!cmdResult.ok) {
      if (
        cmdResult.code === "INVALID_TRANSITION" ||
        cmdResult.code === "TERMINAL_STATE"
      ) {
        result.skipped.commandRejected += 1;
      } else {
        result.errors.push({
          paymentId: payment.id,
          bookingId: payment.booking_id,
          code: cmdResult.code,
          message: cmdResult.message,
        });
      }
      continue;
    }

    result.expired += 1;
  }

  return result;
}
