import "server-only";

import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import {
  buildOfflinePaymentChargeForFinalize,
  buildOfflinePaymentReference,
} from "@/features/payments/server/buildOfflinePaymentChargeForFinalize";
import { finalizePaidBookingWithDeps } from "@/features/payments/server/finalizePaidBooking";
import {
  findPaidPaymentForBooking,
  findPendingPaymentForBooking,
  updatePaymentOfflineProvider,
} from "@/features/payments/server/paymentRepository";
import { isAdminAssistedOfflinePaymentsActive } from "@/lib/app/adminAssistedOfflinePaymentsFlag";
import type { CurrentUser } from "@/lib/auth/types";
import type { Json } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  findAdminBookingAssistOfflinePaymentIdempotency,
  storeAdminBookingAssistIdempotencyResult,
  type AdminBookingOfflinePaymentIdempotencyResult,
} from "./adminBookingAssistIdempotency";
import {
  findAdminOfflinePaymentEventByIdempotencyKey,
  findFinalizedAdminOfflinePaymentEventForBooking,
  insertAdminOfflinePaymentEvent,
  markAdminOfflinePaymentEventFailed,
  markAdminOfflinePaymentEventFinalized,
} from "./adminOfflinePaymentEventRepository";
import type { AdminOfflinePaymentRail } from "./adminOfflinePaymentTypes";
import {
  isAdminAssistPaymentLinkActive,
  readAdminAssistPaymentLinkMetadata,
} from "./adminAssistPaymentLinkMetadata";
import type { AdminRecordOfflinePaymentBody } from "./parseAdminRecordOfflinePaymentBody";
import { recordAdminBookingAssistAudit } from "./recordAdminBookingAssistAudit";
import { sanitizeAdminBookingAssistAuditPayload } from "./buildAdminBookingDraftMetadata";
import { validateAdminAssistedPendingPaymentForOfflineRecord } from "./validateAdminAssistedBookingReady";

export type AdminRecordOfflinePaymentInput = {
  admin: CurrentUser;
  bookingId: string;
  body: AdminRecordOfflinePaymentBody;
};

export type AdminOfflinePaymentRecordResult = {
  bookingId: string;
  status: "confirmed";
  paymentStatus: "paid";
  rail: AdminOfflinePaymentRail;
  reference: string;
  idempotent: boolean;
};

export type AdminRecordOfflinePaymentResult =
  | { ok: true; payment: AdminOfflinePaymentRecordResult }
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
        | "AMOUNT_MISMATCH"
        | "PAYMENT_ALREADY_PAID"
        | "NO_PENDING_PAYMENT"
        | "ACTIVE_PAYMENT_LINK"
        | "DUPLICATE_OFFLINE_PAYMENT"
        | "FINALIZE_FAILED"
        | "PERSISTENCE_ERROR";
      message: string;
      status: number;
    };

function fail(
  code: Extract<AdminRecordOfflinePaymentResult, { ok: false }>["code"],
  message: string,
  status: number,
): AdminRecordOfflinePaymentResult {
  return { ok: false, code, message, status };
}

function railProviderReference(body: AdminRecordOfflinePaymentBody): string {
  if (body.rail === "eft") return body.bankReference!.trim();
  if (body.rail === "card_machine") return body.terminalReference!.trim();
  return body.receiptNumber!.trim();
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
      action: "admin_booking_offline_payment_rejected",
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

function toSuccessResult(
  stored: AdminBookingOfflinePaymentIdempotencyResult,
  idempotent: boolean,
): AdminRecordOfflinePaymentResult {
  return {
    ok: true,
    payment: {
      bookingId: stored.bookingId,
      status: "confirmed",
      paymentStatus: "paid",
      rail: stored.rail,
      reference: stored.reference,
      idempotent,
    },
  };
}

export async function adminRecordOfflinePaymentFacade(
  input: AdminRecordOfflinePaymentInput,
): Promise<AdminRecordOfflinePaymentResult> {
  const { admin, bookingId, body } = input;

  if (admin.role !== "admin") {
    return fail("FORBIDDEN", "Admins only.", 403);
  }

  if (!isAdminAssistedOfflinePaymentsActive()) {
    return fail(
      "FEATURE_DISABLED",
      "Admin offline payments are not enabled. Set ADMIN_ASSISTED_BOOKING_ENABLED=true and ADMIN_ASSISTED_OFFLINE_PAYMENTS_ENABLED=true.",
      403,
    );
  }

  const idempotencyKey = body.idempotencyKey.trim();
  const customerId = body.customerId;
  const serviceClient = requireServiceRoleClient();

  const existingIdempotency = await findAdminBookingAssistOfflinePaymentIdempotency(
    serviceClient,
    idempotencyKey,
  );
  if (existingIdempotency) {
    if (existingIdempotency.bookingId === bookingId) {
      await recordAdminBookingAssistAudit(serviceClient, {
        adminProfileId: admin.profileId,
        customerId,
        bookingId,
        action: "admin_booking_offline_payment_idempotency_replayed",
        idempotencyKey,
        payload: { idempotentReplay: true, rail: existingIdempotency.rail } as Json,
      }).catch(() => undefined);
      return toSuccessResult(existingIdempotency, true);
    }
    return fail(
      "INVALID_PAYLOAD",
      "Idempotency key was used for a different booking.",
      409,
    );
  }

  const existingEvent = await findAdminOfflinePaymentEventByIdempotencyKey(
    serviceClient,
    idempotencyKey,
  );
  if (existingEvent && existingEvent.booking_id !== bookingId) {
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

  const validation = validateAdminAssistedPendingPaymentForOfflineRecord({
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
          : "INVALID_STATUS";
    const rejection = fail(code, validation.message, code === "NOT_ADMIN_ASSISTED" ? 422 : 409);
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

  if (body.amountCents !== booking.price_cents) {
    const rejection = fail(
      "AMOUNT_MISMATCH",
      `Amount ${body.amountCents} does not match booking total ${booking.price_cents}.`,
      422,
    );
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { amountCents: body.amountCents, bookingPriceCents: booking.price_cents },
    });
    return rejection;
  }

  const paidPayment = await findPaidPaymentForBooking(serviceClient, bookingId);
  if (paidPayment) {
    const rejection = fail(
      "PAYMENT_ALREADY_PAID",
      "Booking already has a paid payment.",
      409,
    );
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { paymentId: paidPayment.id },
    });
    return rejection;
  }

  const finalizedOffline = await findFinalizedAdminOfflinePaymentEventForBooking(
    serviceClient,
    bookingId,
  );
  if (finalizedOffline) {
    return fail(
      "DUPLICATE_OFFLINE_PAYMENT",
      "An offline payment was already recorded for this booking.",
      409,
    );
  }

  const activeLink = readAdminAssistPaymentLinkMetadata(booking.metadata);
  if (activeLink && isAdminAssistPaymentLinkActive(activeLink)) {
    if (!body.confirmSupersedesActivePaymentLink) {
      const rejection = fail(
        "ACTIVE_PAYMENT_LINK",
        "An active Paystack payment link exists. Confirm you are recording offline payment instead.",
        409,
      );
      await recordRejectionAudit({
        adminProfileId: admin.profileId,
        customerId,
        bookingId,
        idempotencyKey,
        reasonCode: rejection.code,
        message: rejection.message,
        payload: { reference: activeLink.reference },
      });
      return rejection;
    }
  }

  const pendingPayment = await findPendingPaymentForBooking(serviceClient, bookingId);
  if (!pendingPayment) {
    return fail(
      "NO_PENDING_PAYMENT",
      "No pending payment row found for this booking.",
      409,
    );
  }

  const providerReference = railProviderReference(body);
  const offlineReference = buildOfflinePaymentReference(body.rail, idempotencyKey);

  let offlineEvent = existingEvent;
  if (!offlineEvent) {
    try {
      offlineEvent = await insertAdminOfflinePaymentEvent(serviceClient, {
        bookingId,
        customerId,
        adminProfileId: admin.profileId,
        rail: body.rail,
        amountCents: body.amountCents,
        currency: booking.currency,
        evidenceReference: body.evidenceReference.trim(),
        providerReference,
        idempotencyKey,
        payload: sanitizeAdminBookingAssistAuditPayload({
          reason: body.reason.trim(),
          notes: body.notes?.trim() || null,
          receivedAt: body.receivedAt,
          evidenceReference: body.evidenceReference.trim(),
        }) as Json,
      });
    } catch (e) {
      const raced = await findAdminOfflinePaymentEventByIdempotencyKey(
        serviceClient,
        idempotencyKey,
      );
      if (!raced) {
        return fail(
          "PERSISTENCE_ERROR",
          e instanceof Error ? e.message : "Could not record offline payment event.",
          500,
        );
      }
      offlineEvent = raced;
    }
  }

  if (offlineEvent.status === "finalized") {
    const racedIdempotency = await findAdminBookingAssistOfflinePaymentIdempotency(
      serviceClient,
      idempotencyKey,
    );
    if (racedIdempotency) {
      return toSuccessResult(racedIdempotency, true);
    }
  }

  const charge = buildOfflinePaymentChargeForFinalize({
    rail: body.rail,
    amountCents: body.amountCents,
    currency: booking.currency,
    paidAt: body.receivedAt,
    idempotencyKey,
    eventId: offlineEvent.id,
    adminProfileId: admin.profileId,
    evidenceReference: body.evidenceReference.trim(),
    providerReference,
    bankReference: body.bankReference ?? null,
    terminalReference: body.terminalReference ?? null,
    receiptNumber: body.receiptNumber ?? null,
    notes: body.notes ?? null,
  });

  try {
    await updatePaymentOfflineProvider(serviceClient, pendingPayment.id, {
      provider: body.rail,
      providerRef: offlineReference,
      metadata: {
        ...(typeof pendingPayment.metadata === "object" && pendingPayment.metadata
          ? (pendingPayment.metadata as Record<string, unknown>)
          : {}),
        adminOfflinePayment: {
          rail: body.rail,
          evidenceReference: body.evidenceReference.trim(),
          providerReference,
          offlineEventId: offlineEvent.id,
        },
      },
    });
  } catch (e) {
    await markAdminOfflinePaymentEventFailed(serviceClient, offlineEvent.id).catch(() => undefined);
    return fail(
      "PERSISTENCE_ERROR",
      e instanceof Error ? e.message : "Could not update payment row.",
      500,
    );
  }

  const finalizeResult = await finalizePaidBookingWithDeps(serviceClient, backend, {
    bookingId,
    paymentId: pendingPayment.id,
    charge,
    source: "offline",
  });

  if (!finalizeResult.ok) {
    await markAdminOfflinePaymentEventFailed(serviceClient, offlineEvent.id).catch(() => undefined);
    const code =
      finalizeResult.code === "AMOUNT_MISMATCH" ? "AMOUNT_MISMATCH" : "FINALIZE_FAILED";
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      idempotencyKey,
      reasonCode: code,
      message: finalizeResult.message,
      payload: { finalizeCode: finalizeResult.code },
    });
    return fail(code, finalizeResult.message, code === "AMOUNT_MISMATCH" ? 422 : 500);
  }

  await markAdminOfflinePaymentEventFinalized(serviceClient, offlineEvent.id);

  const stored: AdminBookingOfflinePaymentIdempotencyResult = {
    bookingId,
    status: "offline_payment",
    rail: body.rail,
    reference: offlineReference,
    paymentId: pendingPayment.id,
    priceCents: booking.price_cents,
    currency: booking.currency,
    idempotent: false,
  };

  try {
    await storeAdminBookingAssistIdempotencyResult(serviceClient, {
      idempotencyKey,
      adminProfileId: admin.profileId,
      customerId,
      result: stored,
    });
  } catch {
    const raced = await findAdminBookingAssistOfflinePaymentIdempotency(
      serviceClient,
      idempotencyKey,
    );
    if (raced) {
      return toSuccessResult(raced, true);
    }
  }

  await recordAdminBookingAssistAudit(serviceClient, {
    adminProfileId: admin.profileId,
    customerId,
    bookingId,
    action: "admin_booking_offline_payment_recorded",
    idempotencyKey,
    payload: sanitizeAdminBookingAssistAuditPayload({
      rail: body.rail,
      amountCents: body.amountCents,
      currency: booking.currency,
      evidenceReference: body.evidenceReference.trim(),
      providerReference,
      paymentId: pendingPayment.id,
      reason: body.reason.trim(),
      reference: offlineReference,
    }) as Json,
  });

  return toSuccessResult(stored, false);
}
