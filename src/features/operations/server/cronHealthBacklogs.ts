import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { findAssignmentRecoveryCandidates } from "@/features/assignments/server/findAssignmentRecoveryCandidates";
import { ASSIGNMENT_RECOVERY_GRACE_MINUTES } from "@/features/assignments/server/constants";
import { getDeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import { BOOKING_LOCK_TTL_MINUTES } from "@/features/bookings/server/lock/constants";
import {
  isStalePendingPayment,
  type ExpirePendingPaymentsSkipped,
} from "@/features/payments/server/expirePendingPayments";
import {
  PENDING_PAYMENT_EXPIRE_BATCH_SIZE,
  PENDING_PAYMENT_EXPIRY_GRACE_MINUTES,
} from "@/features/payments/server/constants";
import type { Database, PaymentStatus } from "@/lib/database/types";

const STALE_PAYMENT_STATUSES: PaymentStatus[] = ["initialized", "pending"];

type StalePaymentRow = {
  id: string;
  booking_id: string;
  status: PaymentStatus;
  payment_link_expires_at: string | null;
  created_at: string;
};

/**
 * Counts abandoned checkout payments that expire-pending-payments would process.
 * Capped at batch size (same scan window as the cron job).
 */
export async function countStalePendingPaymentBacklog(
  client: SupabaseClient<Database>,
  options: {
    now?: Date;
    batchSize?: number;
    graceMinutes?: number;
  } = {},
): Promise<number> {
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
    .limit(batchSize);

  if (error) throw new Error(error.message);

  const stalePayments = (paymentRows ?? []) as StalePaymentRow[];
  const bookingIds = [...new Set(stalePayments.map((p) => p.booking_id))];
  if (bookingIds.length === 0) return 0;

  const { data: bookings, error: bookingError } = await client
    .from("bookings")
    .select("id, status")
    .in("id", bookingIds);

  if (bookingError) throw new Error(bookingError.message);

  const pendingBookingIds = new Set(
    (bookings ?? []).filter((b) => b.status === "pending_payment").map((b) => b.id),
  );

  let count = 0;
  for (const payment of stalePayments) {
    if (!pendingBookingIds.has(payment.booking_id)) continue;
    if (isStalePendingPayment(payment, now, graceMinutes)) count += 1;
  }

  return count;
}

/** Open offers past expires_at that expire-assignment-offers should expire. */
export async function countPastExpiryOpenOfferBacklog(
  client: SupabaseClient<Database>,
  options: { now?: Date } = {},
): Promise<number> {
  const nowIso = (options.now ?? new Date()).toISOString();

  const { count, error } = await client
    .from("assignment_offers")
    .select("*", { count: "exact", head: true })
    .eq("status", "offered")
    .not("expires_at", "is", null)
    .lte("expires_at", nowIso);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Paid confirmed bookings past grace with no assignment progress (recovery cron backlog). */
export async function countAssignmentRecoveryBacklog(
  client: SupabaseClient<Database>,
  options: {
    now?: Date;
    graceMinutes?: number;
    batchSize?: number;
  } = {},
): Promise<number> {
  const candidates = await findAssignmentRecoveryCandidates(client, {
    now: options.now,
    graceMinutes: options.graceMinutes ?? ASSIGNMENT_RECOVERY_GRACE_MINUTES,
    batchSize: options.batchSize,
  });
  return candidates.length;
}

export async function countDeferredDispatchOverdueBacklog(
  client: SupabaseClient<Database>,
  options: { now?: Date; deferredEnabled?: boolean } = {},
): Promise<number> {
  const diagnostics = await getDeferredAssignmentDiagnostics(client, {
    now: options.now,
    deferredEnabled: options.deferredEnabled,
  });
  return diagnostics.overdueDispatchCount;
}

export type DeferredDispatchCronRunSummary = {
  lastSuccessfulRunAt: string | null;
  lastFailureRunAt: string | null;
  recentFailureCount24h: number;
};

export async function loadDeferredDispatchCronRunSummary(
  client: SupabaseClient<Database>,
  options: { now?: Date } = {},
): Promise<DeferredDispatchCronRunSummary> {
  const now = options.now ?? new Date();
  const sinceIso = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();

  const { data: lastSuccess, error: successErr } = await client
    .from("deferred_dispatch_cron_runs")
    .select("completed_at")
    .eq("ok", true)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (successErr) throw new Error(successErr.message);

  const { data: lastFailure, error: failureErr } = await client
    .from("deferred_dispatch_cron_runs")
    .select("completed_at")
    .eq("ok", false)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (failureErr) throw new Error(failureErr.message);

  const { count: recentFailures, error: recentErr } = await client
    .from("deferred_dispatch_cron_runs")
    .select("*", { count: "exact", head: true })
    .eq("ok", false)
    .gte("completed_at", sinceIso);

  if (recentErr) throw new Error(recentErr.message);

  return {
    lastSuccessfulRunAt: lastSuccess?.completed_at ?? null,
    lastFailureRunAt: lastFailure?.completed_at ?? null,
    recentFailureCount24h: recentFailures ?? 0,
  };
}

/** Exported for tests — mirrors expire job skip accounting without mutations. */
export function summarizeStalePaymentScan(
  candidates: StalePaymentRow[],
  bookingStatusById: Map<string, string>,
  now: Date,
  graceMinutes: number = PENDING_PAYMENT_EXPIRY_GRACE_MINUTES,
): { backlogCount: number; skipped: ExpirePendingPaymentsSkipped } {
  const skipped: ExpirePendingPaymentsSkipped = {
    paid: 0,
    notYetDue: 0,
    wrongBookingStatus: 0,
    alreadyFailed: 0,
    commandRejected: 0,
  };
  let backlogCount = 0;

  for (const payment of candidates) {
    const bookingStatus = bookingStatusById.get(payment.booking_id);
    if (payment.status === "paid") {
      skipped.paid += 1;
      continue;
    }
    if (payment.status === "failed" || payment.status === "refunded") {
      skipped.alreadyFailed += 1;
      continue;
    }
    if (bookingStatus !== "pending_payment") {
      skipped.wrongBookingStatus += 1;
      continue;
    }
    if (!isStalePendingPayment(payment, now, graceMinutes)) {
      skipped.notYetDue += 1;
      continue;
    }
    backlogCount += 1;
  }

  return { backlogCount, skipped };
}
