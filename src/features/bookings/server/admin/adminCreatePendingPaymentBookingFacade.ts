import "server-only";

import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { isAdminAssistedBookingEnabled } from "@/lib/app/adminAssistedBookingFlag";
import type { CurrentUser } from "@/lib/auth/types";
import type { Json } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  findAdminBookingAssistPendingPaymentIdempotency,
  storeAdminBookingAssistIdempotencyResult,
  type AdminBookingPendingPaymentIdempotencyResult,
} from "./adminBookingAssistIdempotency";
import {
  adminAssistPaymentIdempotencyKey,
  type AdminCreatePendingPaymentBody,
} from "./parseAdminCreatePendingPaymentBody";
import { recordAdminBookingAssistAudit } from "./recordAdminBookingAssistAudit";
import { sanitizeAdminBookingAssistAuditPayload } from "./buildAdminBookingDraftMetadata";
import { validateAdminAssistedDraftForPendingPayment } from "./validateAdminAssistedBookingReady";

export type AdminCreatePendingPaymentBookingInput = {
  admin: CurrentUser;
  bookingId: string;
  body: AdminCreatePendingPaymentBody;
};

export type AdminPendingPaymentBookingResult = {
  bookingId: string;
  status: "pending_payment";
  paymentStatus: "pending";
  priceCents: number;
  currency: string;
  idempotent: boolean;
};

export type AdminCreatePendingPaymentBookingResult =
  | { ok: true; booking: AdminPendingPaymentBookingResult }
  | {
      ok: false;
      code:
        | "FORBIDDEN"
        | "FEATURE_DISABLED"
        | "INVALID_PAYLOAD"
        | "BOOKING_NOT_FOUND"
        | "WRONG_CUSTOMER"
        | "INVALID_STATUS"
        | "NOT_ADMIN_ASSISTED"
        | "INCOMPLETE_BOOKING"
        | "PERSISTENCE_ERROR";
      message: string;
      status: number;
    };

function fail(
  code: Extract<AdminCreatePendingPaymentBookingResult, { ok: false }>["code"],
  message: string,
  status: number,
): AdminCreatePendingPaymentBookingResult {
  return { ok: false, code, message, status };
}

async function recordRejectionAudit(input: {
  adminProfileId: string;
  customerId: string;
  bookingId: string;
  idempotencyKey: string;
  reasonCode: string;
  message: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    const client = requireServiceRoleClient();
    await recordAdminBookingAssistAudit(client, {
      adminProfileId: input.adminProfileId,
      customerId: input.customerId,
      bookingId: input.bookingId,
      action: "admin_booking_pending_payment_rejected",
      idempotencyKey: input.idempotencyKey,
      payload: sanitizeAdminBookingAssistAuditPayload({
        reasonCode: input.reasonCode,
        message: input.message,
        ...input.payload,
      }) as Json,
    });
  } catch {
    // Best-effort rejection audit.
  }
}

export async function adminCreatePendingPaymentBookingFacade(
  input: AdminCreatePendingPaymentBookingInput,
): Promise<AdminCreatePendingPaymentBookingResult> {
  const { admin, bookingId, body } = input;

  if (admin.role !== "admin") {
    return fail("FORBIDDEN", "Admins only.", 403);
  }

  if (!isAdminAssistedBookingEnabled()) {
    return fail(
      "FEATURE_DISABLED",
      "Admin-assisted booking is not enabled. Set ADMIN_ASSISTED_BOOKING_ENABLED=true after rollout sign-off.",
      403,
    );
  }

  const idempotencyKey = body.idempotencyKey.trim();
  const customerId = body.customerId;
  const serviceClient = requireServiceRoleClient();

  const existing = await findAdminBookingAssistPendingPaymentIdempotency(
    serviceClient,
    idempotencyKey,
  );
  if (existing) {
    if (existing.bookingId === bookingId) {
      await recordAdminBookingAssistAudit(serviceClient, {
        adminProfileId: admin.profileId,
        customerId,
        bookingId,
        action: "admin_booking_pending_payment_idempotency_replayed",
        idempotencyKey,
        payload: {
          bookingId: existing.bookingId,
          status: existing.status,
          paymentStatus: existing.paymentStatus,
        } as Json,
      }).catch(() => undefined);

      return {
        ok: true,
        booking: {
          bookingId: existing.bookingId,
          status: "pending_payment",
          paymentStatus: "pending",
          priceCents: existing.priceCents,
          currency: existing.currency,
          idempotent: true,
        },
      };
    }
    return fail(
      "INVALID_PAYLOAD",
      "Idempotency key was used for a different booking.",
      409,
    );
  }

  const backend = createBookingCommandBackend();
  const booking = await backend.getBooking(bookingId);
  if (!booking) {
    return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
  }

  if (booking.customer_id !== customerId) {
    const rejection = fail("WRONG_CUSTOMER", "Booking does not belong to this customer.", 403);
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { expectedCustomerId: customerId },
    });
    return rejection;
  }

  const validation = validateAdminAssistedDraftForPendingPayment({
    id: booking.id,
    customer_id: booking.customer_id,
    status: booking.status,
    scheduled_start: booking.scheduled_start,
    scheduled_end: booking.scheduled_end,
    price_cents: booking.price_cents,
    metadata: booking.metadata,
  });

  if (!validation.ok) {
    const code =
      validation.code === "INVALID_STATUS"
        ? "INVALID_STATUS"
        : validation.code === "NOT_ADMIN_ASSISTED"
          ? "NOT_ADMIN_ASSISTED"
          : "INCOMPLETE_BOOKING";
    const rejection = fail(code, validation.message, code === "INVALID_STATUS" ? 409 : 422);
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { validationCode: validation.code },
    });
    return rejection;
  }

  const paymentIdempotencyKey = adminAssistPaymentIdempotencyKey(idempotencyKey);
  const pending = await executeBookingCommand(
    backend,
    {
      type: "MARK_PAYMENT_PENDING",
      actor: { actorType: "admin", profileId: admin.profileId },
      bookingId,
      paymentIdempotencyKey,
      provider: "paystack",
      reason: body.reason?.trim() || "admin_assisted_pending_payment",
    },
    {},
  );

  if (!pending.ok) {
    const rejection = fail(
      pending.code === "FORBIDDEN" ? "FORBIDDEN" : "PERSISTENCE_ERROR",
      pending.message,
      pending.code === "FORBIDDEN" ? 403 : 500,
    );
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { commandCode: pending.code },
    });
    return rejection;
  }

  if (pending.status !== "pending_payment") {
    return fail(
      "PERSISTENCE_ERROR",
      `Expected pending_payment after MARK_PAYMENT_PENDING, got "${pending.status}".`,
      500,
    );
  }

  const refreshed = await backend.getBooking(bookingId);
  if (!refreshed || refreshed.status !== "pending_payment") {
    return fail("PERSISTENCE_ERROR", "Booking did not reach pending_payment.", 500);
  }

  const payments = await backend.listPaymentsForBooking(bookingId);
  const latestPayment = payments[0] ?? null;
  const paymentStatus = latestPayment?.status === "pending" ? "pending" : "pending";

  const result: AdminBookingPendingPaymentIdempotencyResult = {
    bookingId,
    status: "pending_payment",
    paymentStatus,
    priceCents: refreshed.price_cents,
    currency: refreshed.currency,
    idempotent: pending.idempotent,
  };

  try {
    await storeAdminBookingAssistIdempotencyResult(serviceClient, {
      idempotencyKey,
      adminProfileId: admin.profileId,
      customerId,
      result: { ...result, idempotent: false },
    });
  } catch (e) {
    const raced = await findAdminBookingAssistPendingPaymentIdempotency(
      serviceClient,
      idempotencyKey,
    );
    if (raced) {
      return {
        ok: true,
        booking: {
          bookingId: raced.bookingId,
          status: "pending_payment",
          paymentStatus: "pending",
          priceCents: raced.priceCents,
          currency: raced.currency,
          idempotent: true,
        },
      };
    }
    return fail(
      "PERSISTENCE_ERROR",
      e instanceof Error ? e.message : "Could not store idempotency outcome.",
      500,
    );
  }

  await recordAdminBookingAssistAudit(serviceClient, {
    adminProfileId: admin.profileId,
    customerId,
    bookingId,
    action: "admin_booking_pending_payment_created",
    idempotencyKey,
    payload: sanitizeAdminBookingAssistAuditPayload({
      bookingId,
      status: "pending_payment",
      paymentStatus,
      priceCents: refreshed.price_cents,
      currency: refreshed.currency,
      paymentIdempotencyKey,
      reason: body.reason?.trim() || null,
    }) as Json,
  });

  return {
    ok: true,
    booking: {
      bookingId,
      status: "pending_payment",
      paymentStatus,
      priceCents: refreshed.price_cents,
      currency: refreshed.currency,
      idempotent: pending.idempotent,
    },
  };
}
