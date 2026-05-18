import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { loadAssignmentContext } from "./assignmentContext";
import { isOfferOpenForOps } from "./buildOfferExpiry";
import { createAdminSupportDispatchOffer } from "./createAdminSupportDispatchOffer";
import { isCleanerEligibleForAssignment } from "./eligibilityForAssignment";
import { listOffersForBooking } from "./offerRepository";
import { offerTeamRole } from "./offerTeamRole";
import { requestedTeamSizeFromBooking } from "./requestedTeamSizeFromBooking";
import { isTeamOffersEnabled } from "./teamOffersConfig";
import {
  validateAdminRecoveryReason,
  ADMIN_RECOVERY_REASON_MAX_LENGTH,
  ADMIN_RECOVERY_REASON_MIN_LENGTH,
} from "./adminAssignmentRecovery";

export {
  ADMIN_RECOVERY_REASON_MIN_LENGTH as ADMIN_SUPPORT_DISPATCH_REASON_MIN_LENGTH,
  ADMIN_RECOVERY_REASON_MAX_LENGTH as ADMIN_SUPPORT_DISPATCH_REASON_MAX_LENGTH,
  validateAdminRecoveryReason as validateAdminSupportDispatchReason,
};

export type AdminSupportDispatchResultStatus = "offered" | "already_offered" | "not_eligible" | "error";

export type AdminSupportDispatchSuccess = {
  ok: true;
  status: AdminSupportDispatchResultStatus;
  bookingId: string;
  bookingStatus: string;
  cleanerId: string;
  offerId?: string | null;
  idempotent?: boolean;
  message: string;
};

export type AdminSupportDispatchFailure = {
  ok: false;
  code: string;
  message: string;
  httpStatus: number;
};

export type AdminSupportDispatchResult =
  | AdminSupportDispatchSuccess
  | AdminSupportDispatchFailure;

export async function runAdminSupportDispatchOffer(
  user: CurrentUser,
  bookingId: string,
  input: {
    cleanerId: string;
    reason: string;
  },
): Promise<AdminSupportDispatchResult> {
  if (user.role !== "admin") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Admins only.",
      httpStatus: 403,
    };
  }

  if (!isTeamOffersEnabled()) {
    return {
      ok: false,
      code: "TEAM_OFFERS_DISABLED",
      message: "Team support dispatch requires TEAM_OFFERS_ENABLED.",
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

  if (requestedTeamSizeFromBooking(booking) < 2) {
    return {
      ok: false,
      code: "NOT_TEAM_REQUEST",
      message: "Support dispatch is only for bookings that requested two cleaners.",
      httpStatus: 409,
    };
  }

  if (booking.status !== "assigned" && booking.status !== "in_progress") {
    return {
      ok: false,
      code: "NOT_ELIGIBLE",
      message: "Support dispatch requires a primary-assigned booking (assigned or in_progress).",
      httpStatus: 409,
    };
  }

  if (!booking.cleaner_id) {
    return {
      ok: false,
      code: "NOT_ELIGIBLE",
      message: "Primary cleaner must be assigned before support dispatch.",
      httpStatus: 409,
    };
  }

  if (booking.cleaner_id === cleanerId) {
    return {
      ok: false,
      code: "NOT_ELIGIBLE",
      message: "Support cleaner must differ from the primary assigned cleaner.",
      httpStatus: 409,
    };
  }

  const offers = await listOffersForBooking(client, bookingId);
  const openSupport = offers.filter(
    (o) => isOfferOpenForOps(o, now) && offerTeamRole(o) === "support",
  );
  const openToOtherSupport = openSupport.find((o) => o.cleaner_id !== cleanerId);
  if (openToOtherSupport) {
    return {
      ok: false,
      code: "OPEN_OFFER_EXISTS",
      message: "Booking already has an open support assignment offer to another cleaner.",
      httpStatus: 409,
    };
  }

  const context = await loadAssignmentContext(client, booking);
  if (!context) {
    return {
      ok: false,
      code: "NOT_ELIGIBLE",
      message: "Assignment context could not be loaded for this booking.",
      httpStatus: 409,
    };
  }

  const eligible = await isCleanerEligibleForAssignment(client, context, cleanerId);
  if (!eligible) {
    return {
      ok: false,
      code: "CLEANER_NOT_ELIGIBLE",
      message: "Cleaner is not eligible for this booking slot and service.",
      httpStatus: 422,
    };
  }

  const openToSame = openSupport.some((o) => o.cleaner_id === cleanerId);
  if (openToSame) {
    const existing = offers.find(
      (o) =>
        o.cleaner_id === cleanerId &&
        o.status === "offered" &&
        offerTeamRole(o) === "support",
    );
    return {
      ok: true,
      status: "already_offered",
      bookingId,
      bookingStatus: booking.status,
      cleanerId,
      offerId: existing?.id ?? null,
      idempotent: true,
      message: "Support offer already open to this cleaner.",
    };
  }

  const commandReason = `Admin support dispatch: ${reasonCheck.reason}`;
  const offerResult = await createAdminSupportDispatchOffer(backend, {
    bookingId,
    cleanerId,
    adminProfileId: user.profileId,
    reason: commandReason,
  });

  if (!offerResult.ok) {
    return {
      ok: false,
      code: offerResult.code ?? "ENGINE_ERROR",
      message: offerResult.message,
      httpStatus: offerResult.code === "OPEN_OFFER_EXISTS" ? 409 : 422,
    };
  }

  const idempotent = offerResult.idempotent === true;
  const status: AdminSupportDispatchResultStatus = idempotent ? "already_offered" : "offered";

  return {
    ok: true,
    status,
    bookingId,
    bookingStatus: booking.status,
    cleanerId,
    offerId: offerResult.offerId ?? null,
    idempotent,
    message: idempotent
      ? "Support offer already open to this cleaner."
      : "Support offer sent. Booking assignment unchanged until support accepts.",
  };
}
