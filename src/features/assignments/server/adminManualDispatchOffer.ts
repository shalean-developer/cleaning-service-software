import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { loadAssignmentContext } from "./assignmentContext";
import { isOfferOpenForOps } from "./buildOfferExpiry";
import {
  ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING,
} from "./constants";
import { createAdminDispatchOffer } from "./createAdminDispatchOffer";
import { isCleanerEligibleForAssignment } from "./eligibilityForAssignment";
import { listOffersForBooking } from "./offerRepository";
import { recordAssignmentOutcome } from "./recordAssignmentOutcome";
import { auditAdminManualDispatch } from "@/features/admin/server/adminOperationalAuditSidecar";
import {
  validateAdminRecoveryReason,
  ADMIN_RECOVERY_REASON_MAX_LENGTH,
  ADMIN_RECOVERY_REASON_MIN_LENGTH,
} from "./adminAssignmentRecovery";

export {
  ADMIN_RECOVERY_REASON_MIN_LENGTH as ADMIN_DISPATCH_REASON_MIN_LENGTH,
  ADMIN_RECOVERY_REASON_MAX_LENGTH as ADMIN_DISPATCH_REASON_MAX_LENGTH,
  validateAdminRecoveryReason as validateAdminDispatchReason,
};

export type AdminManualDispatchResultStatus = "offered" | "already_offered" | "not_eligible" | "error";

export type AdminManualDispatchSuccess = {
  ok: true;
  status: AdminManualDispatchResultStatus;
  bookingId: string;
  bookingStatus: string;
  cleanerId: string;
  offerId?: string | null;
  idempotent?: boolean;
  message: string;
};

export type AdminManualDispatchFailure = {
  ok: false;
  code: string;
  message: string;
  httpStatus: number;
};

export type AdminManualDispatchResult =
  | AdminManualDispatchSuccess
  | AdminManualDispatchFailure;

const TERMINAL_STATUSES = new Set([
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
  "cancelled",
  "payment_failed",
]);

export function logAdminManualDispatch(payload: {
  bookingId: string;
  adminProfileId: string;
  cleanerId: string;
  reason: string;
  resultStatus: AdminManualDispatchResultStatus | "not_eligible" | "error";
  offerId?: string | null;
  idempotent?: boolean;
  code?: string;
}): void {
  console.warn(
    JSON.stringify({
      event: "admin_manual_dispatch",
      at: new Date().toISOString(),
      bookingId: payload.bookingId,
      adminProfileId: payload.adminProfileId,
      cleanerId: payload.cleanerId,
      reason: payload.reason,
      resultStatus: payload.resultStatus,
      offerId: payload.offerId ?? null,
      idempotent: payload.idempotent ?? false,
      code: payload.code ?? null,
    }),
  );
}

export async function runAdminManualDispatchOffer(
  user: CurrentUser,
  bookingId: string,
  input: {
    cleanerId: string;
    reason: string;
    acknowledgeMaxAttempts?: boolean;
  },
): Promise<AdminManualDispatchResult> {
  if (user.role !== "admin") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Admins only.",
      httpStatus: 403,
    };
  }

  const cleanerId = typeof input.cleanerId === "string" ? input.cleanerId.trim() : "";
  if (!cleanerId) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "cleanerId is required.",
      httpStatus: 400,
    };
  }

  const reasonCheck = validateAdminRecoveryReason(input.reason);
  if (!reasonCheck.ok) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: reasonCheck.message,
      httpStatus: 400,
    };
  }

  const client = createServiceRoleClient();
  if (!client) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Service role client not configured.",
      httpStatus: 503,
    };
  }

  const backend = createBookingCommandBackend();
  const now = new Date();

  const { data: booking, error: bookErr } = await client
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookErr) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: bookErr.message,
      httpStatus: 500,
    };
  }

  if (!booking) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Booking not found.",
      httpStatus: 404,
    };
  }

  const { data: payments, error: payErr } = await client
    .from("payments")
    .select("id, status")
    .eq("booking_id", bookingId);

  if (payErr) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: payErr.message,
      httpStatus: 500,
    };
  }

  const offers = await listOffersForBooking(client, bookingId);
  const paidPayment = (payments ?? []).some((p) => p.status === "paid");
  const commandReason = `Admin manual dispatch: ${reasonCheck.reason}`;

  const failNotEligible = async (message: string, code = "NOT_ELIGIBLE") => {
    await auditAdminManualDispatch(client, {
      bookingId,
      adminProfileId: user.profileId,
      cleanerId,
      reason: reasonCheck.reason,
      resultStatus: "not_eligible",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      code,
      openOfferCount: offers.filter((o) => isOfferOpenForOps(o, now)).length,
      dispatchOfferCount: offers.length,
    });
    return {
      ok: false as const,
      code,
      message,
      httpStatus: 409,
    };
  };

  if (booking.status !== "pending_assignment") {
    if (booking.status === "confirmed") {
      return await failNotEligible(
        "Manual dispatch requires pending_assignment. Use assignment recovery first.",
      );
    }
    if (TERMINAL_STATUSES.has(booking.status) || booking.cleaner_id) {
      return await failNotEligible("Booking is not awaiting manual dispatch.");
    }
    return await failNotEligible(
      `Manual dispatch requires status pending_assignment (got ${booking.status}).`,
    );
  }

  if (booking.cleaner_id) {
    return await failNotEligible("Booking already has an assigned cleaner.");
  }

  if (!paidPayment) {
    return await failNotEligible("No paid payment on this booking.", "NO_PAID_PAYMENT");
  }

  const openOffers = offers.filter((o) => isOfferOpenForOps(o, now));
  const openToOther = openOffers.find((o) => o.cleaner_id !== cleanerId);
  if (openToOther) {
    await auditAdminManualDispatch(client, {
      bookingId,
      adminProfileId: user.profileId,
      cleanerId,
      reason: reasonCheck.reason,
      resultStatus: "not_eligible",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      code: "OPEN_OFFER_EXISTS",
    });
    return {
      ok: false,
      code: "OPEN_OFFER_EXISTS",
      message: "Booking already has an open assignment offer to another cleaner.",
      httpStatus: 409,
    };
  }

  if (
    offers.length >= ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING &&
    input.acknowledgeMaxAttempts !== true
  ) {
    return {
      ok: false,
      code: "MAX_ATTEMPTS_REACHED",
      message:
        "Maximum dispatch attempts reached. Confirm acknowledgement to send another offer.",
      httpStatus: 409,
    };
  }

  const context = await loadAssignmentContext(client, booking);
  if (!context) {
    return await failNotEligible("Assignment context could not be loaded for this booking.");
  }

  const eligible = await isCleanerEligibleForAssignment(client, context, cleanerId);
  if (!eligible) {
    await auditAdminManualDispatch(client, {
      bookingId,
      adminProfileId: user.profileId,
      cleanerId,
      reason: reasonCheck.reason,
      resultStatus: "not_eligible",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      code: "CLEANER_NOT_ELIGIBLE",
    });
    return {
      ok: false,
      code: "CLEANER_NOT_ELIGIBLE",
      message: "Cleaner is not eligible for this booking slot and service.",
      httpStatus: 422,
    };
  }

  const openToSame = openOffers.some((o) => o.cleaner_id === cleanerId);
  if (openToSame) {
    const existing = offers.find(
      (o) => o.cleaner_id === cleanerId && o.status === "offered",
    );
    await auditAdminManualDispatch(client, {
      bookingId,
      adminProfileId: user.profileId,
      cleanerId,
      reason: reasonCheck.reason,
      resultStatus: "already_offered",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      offerId: existing?.id ?? null,
      idempotent: true,
    });
    return {
      ok: true,
      status: "already_offered",
      bookingId,
      bookingStatus: booking.status,
      cleanerId,
      offerId: existing?.id ?? null,
      idempotent: true,
      message: "Offer already open to this cleaner.",
    };
  }

  const offerResult = await createAdminDispatchOffer(backend, {
    bookingId,
    cleanerId,
    adminProfileId: user.profileId,
    reason: commandReason,
  });

  if (!offerResult.ok) {
    const code = offerResult.code ?? "ENGINE_ERROR";
    await auditAdminManualDispatch(client, {
      bookingId,
      adminProfileId: user.profileId,
      cleanerId,
      reason: reasonCheck.reason,
      resultStatus: "error",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      code,
    });
    if (code === "OPEN_OFFER_EXISTS") {
      return {
        ok: false,
        code,
        message: offerResult.message,
        httpStatus: 409,
      };
    }
    return {
      ok: false,
      code,
      message: offerResult.message,
      httpStatus: 422,
    };
  }

  const bookingAfter = await backend.getBooking(bookingId);
  if (bookingAfter?.cleaner_id && bookingAfter.cleaner_id !== cleanerId) {
    return {
      ok: false,
      code: "ASSIGNMENT_CONFLICT",
      message: "Unexpected direct assignment detected.",
      httpStatus: 500,
    };
  }

  await recordAssignmentOutcome(backend, bookingId, {
    status: "offered",
    path: "admin_manual",
    cleanerId,
    offerId: offerResult.offerId ?? null,
    reason: reasonCheck.reason,
    lastOfferOutcome: null,
  });

  const idempotent = offerResult.idempotent === true;
  const status: AdminManualDispatchResultStatus = idempotent ? "already_offered" : "offered";

  await auditAdminManualDispatch(client, {
    bookingId,
    adminProfileId: user.profileId,
    cleanerId,
    reason: reasonCheck.reason,
    resultStatus: status,
    bookingStatusBefore: booking.status,
    bookingStatusAfter: bookingAfter?.status ?? booking.status,
    offerId: offerResult.offerId ?? null,
    idempotent,
  });

  return {
    ok: true,
    status,
    bookingId,
    bookingStatus: bookingAfter?.status ?? booking.status,
    cleanerId,
    offerId: offerResult.offerId ?? null,
    idempotent,
    message: idempotent
      ? "Offer already open to this cleaner."
      : "Offer sent to cleaner. Booking remains pending until they accept.",
  };
}
