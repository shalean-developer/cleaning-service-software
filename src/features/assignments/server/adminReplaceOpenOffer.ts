import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { auditAdminReplaceOpenOffer } from "@/features/admin/server/adminOperationalAuditSidecar";
import {
  validateAdminRecoveryReason,
  ADMIN_RECOVERY_REASON_MAX_LENGTH,
  ADMIN_RECOVERY_REASON_MIN_LENGTH,
} from "./adminAssignmentRecovery";
import { loadAssignmentContext } from "./assignmentContext";
import { isOfferOpenForOps } from "./buildOfferExpiry";
import { ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING } from "./constants";
import { createAdminCancelOpenOffer } from "./createAdminCancelOpenOffer";
import { createAdminDispatchOffer } from "./createAdminDispatchOffer";
import { isCleanerEligibleForAssignment } from "./eligibilityForAssignment";
import { listOffersForBooking } from "./offerRepository";
import { recordAssignmentOutcome } from "./recordAssignmentOutcome";

export {
  ADMIN_RECOVERY_REASON_MIN_LENGTH as ADMIN_REPLACE_REASON_MIN_LENGTH,
  ADMIN_RECOVERY_REASON_MAX_LENGTH as ADMIN_REPLACE_REASON_MAX_LENGTH,
  validateAdminRecoveryReason as validateAdminReplaceReason,
};

export type AdminReplaceOpenOfferResultStatus =
  | "replaced"
  | "already_replaced"
  | "not_eligible"
  | "error";

export type AdminReplaceOpenOfferSuccess = {
  ok: true;
  status: AdminReplaceOpenOfferResultStatus;
  bookingId: string;
  bookingStatus: string;
  cancelledOfferId: string;
  cancelledCleanerId: string;
  targetCleanerId: string;
  offerId?: string | null;
  idempotent?: boolean;
  message: string;
};

export type AdminReplaceOpenOfferFailure = {
  ok: false;
  code: string;
  message: string;
  httpStatus: number;
};

export type AdminReplaceOpenOfferResult =
  | AdminReplaceOpenOfferSuccess
  | AdminReplaceOpenOfferFailure;

const TERMINAL_STATUSES = new Set([
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
  "cancelled",
  "payment_failed",
]);

export function logAdminReplaceOpenOffer(payload: {
  bookingId: string;
  adminProfileId: string;
  cancelledOfferId: string | null;
  cancelledCleanerId: string | null;
  targetCleanerId: string;
  reason: string;
  resultStatus: AdminReplaceOpenOfferResultStatus | "not_eligible" | "error";
  offerId?: string | null;
  idempotent?: boolean;
  code?: string;
}): void {
  console.warn(
    JSON.stringify({
      event: "admin_replace_open_offer",
      at: new Date().toISOString(),
      bookingId: payload.bookingId,
      adminProfileId: payload.adminProfileId,
      cancelledOfferId: payload.cancelledOfferId,
      cancelledCleanerId: payload.cancelledCleanerId,
      targetCleanerId: payload.targetCleanerId,
      reason: payload.reason,
      resultStatus: payload.resultStatus,
      offerId: payload.offerId ?? null,
      idempotent: payload.idempotent ?? false,
      code: payload.code ?? null,
    }),
  );
}

export async function runAdminReplaceOpenOffer(
  user: CurrentUser,
  bookingId: string,
  input: {
    targetCleanerId: string;
    reason: string;
    acknowledgeMaxAttempts?: boolean;
  },
): Promise<AdminReplaceOpenOfferResult> {
  if (user.role !== "admin") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Admins only.",
      httpStatus: 403,
    };
  }

  const targetCleanerId =
    typeof input.targetCleanerId === "string" ? input.targetCleanerId.trim() : "";
  if (!targetCleanerId) {
    return {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "targetCleanerId is required.",
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
  const cancelReason = `Admin cancelled open offer: ${reasonCheck.reason}`;
  const offerReason = `Admin replace offer: ${reasonCheck.reason}`;

  const failNotEligible = async (message: string, code = "NOT_ELIGIBLE") => {
    await auditAdminReplaceOpenOffer(client, {
      bookingId,
      adminProfileId: user.profileId,
      cancelledOfferId: null,
      cancelledCleanerId: null,
      targetCleanerId,
      reason: reasonCheck.reason,
      resultStatus: "not_eligible",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      code,
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
        "Replace requires pending_assignment. Use assignment recovery first.",
      );
    }
    return await failNotEligible("Booking is not awaiting offer replacement.");
  }

  if (booking.cleaner_id) {
    return await failNotEligible("Booking already has an assigned cleaner.");
  }

  if (!paidPayment) {
    return await failNotEligible("No paid payment on this booking.", "NO_PAID_PAYMENT");
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

  const openOffers = offers.filter((o) => isOfferOpenForOps(o, now));

  if (openOffers.length === 0) {
    const targetOpen = offers.find(
      (o) => o.cleaner_id === targetCleanerId && o.status === "offered",
    );
    if (targetOpen && isOfferOpenForOps(targetOpen, now)) {
      await auditAdminReplaceOpenOffer(client, {
        bookingId,
        adminProfileId: user.profileId,
        cancelledOfferId: null,
        cancelledCleanerId: null,
        targetCleanerId,
        reason: reasonCheck.reason,
        resultStatus: "already_replaced",
        bookingStatusBefore: booking.status,
        bookingStatusAfter: booking.status,
        offerId: targetOpen.id,
        idempotent: true,
      });
      return {
        ok: true,
        status: "already_replaced",
        bookingId,
        bookingStatus: booking.status,
        cancelledOfferId: "",
        cancelledCleanerId: "",
        targetCleanerId,
        offerId: targetOpen.id,
        idempotent: true,
        message: "Replacement offer already open to this cleaner.",
      };
    }
    return await failNotEligible("No open offer to replace.", "NO_OPEN_OFFER");
  }

  if (openOffers.length > 1) {
    return {
      ok: false,
      code: "MULTIPLE_OPEN_OFFERS",
      message: "Multiple open offers detected; cannot replace safely.",
      httpStatus: 409,
    };
  }

  const openOffer = openOffers[0]!;

  if (openOffer.cleaner_id === targetCleanerId) {
    return {
      ok: false,
      code: "SAME_CLEANER",
      message: "Target cleaner is the same as the current open offer.",
      httpStatus: 409,
    };
  }

  const context = await loadAssignmentContext(client, booking);
  if (!context) {
    return await failNotEligible("Assignment context could not be loaded for this booking.");
  }

  const eligible = await isCleanerEligibleForAssignment(client, context, targetCleanerId);
  if (!eligible) {
    await auditAdminReplaceOpenOffer(client, {
      bookingId,
      adminProfileId: user.profileId,
      cancelledOfferId: openOffer.id,
      cancelledCleanerId: openOffer.cleaner_id,
      targetCleanerId,
      reason: reasonCheck.reason,
      resultStatus: "not_eligible",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      code: "CLEANER_NOT_ELIGIBLE",
    });
    return {
      ok: false,
      code: "CLEANER_NOT_ELIGIBLE",
      message: "Target cleaner is not eligible for this booking slot and service.",
      httpStatus: 422,
    };
  }

  const cancelResult = await createAdminCancelOpenOffer(backend, {
    bookingId,
    offerId: openOffer.id,
    adminProfileId: user.profileId,
    reason: cancelReason,
  });

  if (!cancelResult.ok) {
    await auditAdminReplaceOpenOffer(client, {
      bookingId,
      adminProfileId: user.profileId,
      cancelledOfferId: openOffer.id,
      cancelledCleanerId: openOffer.cleaner_id,
      targetCleanerId,
      reason: reasonCheck.reason,
      resultStatus: "error",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      code: cancelResult.code,
    });
    return {
      ok: false,
      code: cancelResult.code ?? "ENGINE_ERROR",
      message: cancelResult.message,
      httpStatus: 422,
    };
  }

  const offersAfterCancel = await listOffersForBooking(client, bookingId);
  const stillOpen = offersAfterCancel.filter((o) => isOfferOpenForOps(o, now));
  if (stillOpen.length > 0) {
    return {
      ok: false,
      code: "OPEN_OFFER_EXISTS",
      message: "Open offer still exists after cancel; try again.",
      httpStatus: 409,
    };
  }

  const offerResult = await createAdminDispatchOffer(backend, {
    bookingId,
    cleanerId: targetCleanerId,
    adminProfileId: user.profileId,
    reason: offerReason,
  });

  if (!offerResult.ok) {
    await auditAdminReplaceOpenOffer(client, {
      bookingId,
      adminProfileId: user.profileId,
      cancelledOfferId: openOffer.id,
      cancelledCleanerId: openOffer.cleaner_id,
      targetCleanerId,
      reason: reasonCheck.reason,
      resultStatus: "error",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      code: offerResult.code,
    });
    const code = offerResult.code ?? "ENGINE_ERROR";
    if (code === "OPEN_OFFER_EXISTS") {
      return {
        ok: false,
        code: "OPEN_OFFER_EXISTS",
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
  if (bookingAfter?.cleaner_id) {
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
    cleanerId: targetCleanerId,
    offerId: offerResult.offerId ?? null,
    reason: reasonCheck.reason,
    lastOfferOutcome: "cancelled",
  });

  const idempotent = cancelResult.idempotent === true && offerResult.idempotent === true;
  const status: AdminReplaceOpenOfferResultStatus = idempotent ? "already_replaced" : "replaced";

  await auditAdminReplaceOpenOffer(client, {
    bookingId,
    adminProfileId: user.profileId,
    cancelledOfferId: openOffer.id,
    cancelledCleanerId: openOffer.cleaner_id,
    targetCleanerId,
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
    cancelledOfferId: openOffer.id,
    cancelledCleanerId: openOffer.cleaner_id,
    targetCleanerId,
    offerId: offerResult.offerId ?? null,
    idempotent,
    message: idempotent
      ? "Replacement offer already in place."
      : "Open offer cancelled and new offer sent. Booking remains pending until the cleaner accepts.",
  };
}
