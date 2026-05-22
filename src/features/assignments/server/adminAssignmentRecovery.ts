import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isOfferOpenForOps } from "./buildOfferExpiry";
import { ASSIGNMENT_RECOVERY_GRACE_MINUTES } from "./constants";
import { isAssignmentRecoveryCandidate } from "./isAssignmentRecoveryCandidate";
import { listOffersForBooking } from "./offerRepository";
import { auditAdminAssignmentRecovery } from "@/features/admin/server/adminOperationalAuditSidecar";
import { recoverAssignmentForBooking } from "./runAssignmentRecovery";
import type { RunAssignmentResult } from "./types";

export const ADMIN_RECOVERY_REASON_MIN_LENGTH = 8;
export const ADMIN_RECOVERY_REASON_MAX_LENGTH = 500;

export type AdminRecoveryResultStatus =
  | "recovered"
  | "already_recovered"
  | "not_eligible"
  | "still_confirmed"
  | "error";

export type AdminSingleBookingRecoverySuccess = {
  ok: true;
  status: AdminRecoveryResultStatus;
  bookingId: string;
  bookingStatus: string;
  outcome?: string;
  offerId?: string | null;
  cleanerId?: string | null;
  idempotent?: boolean;
  message: string;
};

export type AdminSingleBookingRecoveryFailure = {
  ok: false;
  code: string;
  message: string;
  httpStatus: number;
};

export type AdminSingleBookingRecoveryResult =
  | AdminSingleBookingRecoverySuccess
  | AdminSingleBookingRecoveryFailure;

export function validateAdminRecoveryReason(
  reason: unknown,
): { ok: true; reason: string } | { ok: false; message: string } {
  if (typeof reason !== "string") {
    return { ok: false, message: "A reason is required." };
  }
  const trimmed = reason.trim();
  if (trimmed.length < ADMIN_RECOVERY_REASON_MIN_LENGTH) {
    return {
      ok: false,
      message: `Reason must be at least ${ADMIN_RECOVERY_REASON_MIN_LENGTH} characters.`,
    };
  }
  if (trimmed.length > ADMIN_RECOVERY_REASON_MAX_LENGTH) {
    return {
      ok: false,
      message: `Reason must be at most ${ADMIN_RECOVERY_REASON_MAX_LENGTH} characters.`,
    };
  }
  return { ok: true, reason: trimmed };
}

export function logAdminAssignmentRecovery(payload: {
  bookingId: string;
  adminProfileId: string;
  reason: string;
  eligible: boolean;
  resultStatus: AdminRecoveryResultStatus;
  bookingStatusAfter: string | null;
  engine?: RunAssignmentResult | null;
}): void {
  console.warn(
    JSON.stringify({
      event: "admin_assignment_recovery",
      at: new Date().toISOString(),
      bookingId: payload.bookingId,
      adminProfileId: payload.adminProfileId,
      reason: payload.reason,
      eligible: payload.eligible,
      resultStatus: payload.resultStatus,
      bookingStatusAfter: payload.bookingStatusAfter,
      engine: payload.engine
        ? payload.engine.ok
          ? {
              ok: true,
              outcome: payload.engine.outcome,
              bookingStatus: payload.engine.bookingStatus,
              idempotent: payload.engine.idempotent,
            }
          : { ok: false, code: payload.engine.code, message: payload.engine.message }
        : null,
    }),
  );
}

const ALREADY_RECOVERED_STATUSES = new Set([
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

function isInsideGraceWindow(
  paidAt: string,
  now: Date,
  graceMinutes: number,
): boolean {
  const paidAtMs = new Date(paidAt).getTime();
  if (Number.isNaN(paidAtMs)) return false;
  return now.getTime() - paidAtMs < graceMinutes * 60_000;
}

export async function runAdminSingleBookingAssignmentRecovery(
  user: CurrentUser,
  bookingId: string,
  input: { reason: string },
): Promise<AdminSingleBookingRecoveryResult> {
  if (user.role !== "admin") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Admins only.",
      httpStatus: 403,
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
  const graceMinutes = ASSIGNMENT_RECOVERY_GRACE_MINUTES;

  const { data: booking, error: bookErr } = await client
    .from("bookings")
    .select("id, status, cleaner_id")
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
    .select("id, status, updated_at, created_at")
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
  const paidPayment = (payments ?? []).find((p) => p.status === "paid");

  if (booking.status !== "confirmed") {
    if (ALREADY_RECOVERED_STATUSES.has(booking.status)) {
      await auditAdminAssignmentRecovery(client, {
        bookingId,
        adminProfileId: user.profileId,
        reason: reasonCheck.reason,
        eligible: false,
        resultStatus: "already_recovered",
        bookingStatusBefore: booking.status,
        bookingStatusAfter: booking.status,
        engine: null,
        idempotent: true,
      });
      return {
        ok: true,
        status: "already_recovered",
        bookingId,
        bookingStatus: booking.status,
        message: "Booking has already progressed past payment confirmation.",
      };
    }

    const openOfferExists = offers.some((o) => isOfferOpenForOps(o));

    if (booking.status === "pending_assignment" && !openOfferExists) {
      await auditAdminAssignmentRecovery(client, {
        bookingId,
        adminProfileId: user.profileId,
        reason: reasonCheck.reason,
        eligible: false,
        resultStatus: "already_recovered",
        bookingStatusBefore: booking.status,
        bookingStatusAfter: booking.status,
        engine: null,
        idempotent: true,
      });
      return {
        ok: true,
        status: "already_recovered",
        bookingId,
        bookingStatus: booking.status,
        message: "Assignment dispatch has already started for this booking.",
      };
    }

    const notEligibleMessage =
      booking.status === "pending_assignment" && openOfferExists
        ? "Recovery is not available while an offer is open."
        : `Recovery requires status confirmed (got ${booking.status}).`;

    await auditAdminAssignmentRecovery(client, {
      bookingId,
      adminProfileId: user.profileId,
      reason: reasonCheck.reason,
      eligible: false,
      resultStatus: "not_eligible",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      engine: null,
      resultCode: "NOT_ELIGIBLE",
    });
    return {
      ok: false,
      code: "NOT_ELIGIBLE",
      message: notEligibleMessage,
      httpStatus: 409,
    };
  }

  if (!paidPayment) {
    await auditAdminAssignmentRecovery(client, {
      bookingId,
      adminProfileId: user.profileId,
      reason: reasonCheck.reason,
      eligible: false,
      resultStatus: "not_eligible",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      engine: null,
      resultCode: "NO_PAID_PAYMENT",
    });
    return {
      ok: false,
      code: "NO_PAID_PAYMENT",
      message: "No paid payment on this booking.",
      httpStatus: 409,
    };
  }

  const paidAt = paidPayment.updated_at || paidPayment.created_at;
  if (isInsideGraceWindow(paidAt, now, graceMinutes)) {
    const remainingMin = Math.ceil(
      (graceMinutes * 60_000 - (now.getTime() - new Date(paidAt).getTime())) / 60_000,
    );
    await auditAdminAssignmentRecovery(client, {
      bookingId,
      adminProfileId: user.profileId,
      reason: reasonCheck.reason,
      eligible: false,
      resultStatus: "not_eligible",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      engine: null,
      resultCode: "GRACE_PERIOD",
    });
    return {
      ok: false,
      code: "GRACE_PERIOD",
      message: `Wait about ${remainingMin} minute(s) after payment before recovery.`,
      httpStatus: 409,
    };
  }

  const eligible = isAssignmentRecoveryCandidate({
    booking,
    payments: payments ?? [],
    offers,
    now,
    graceMinutes,
  });

  if (!eligible) {
    await auditAdminAssignmentRecovery(client, {
      bookingId,
      adminProfileId: user.profileId,
      reason: reasonCheck.reason,
      eligible: false,
      resultStatus: "not_eligible",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: booking.status,
      engine: null,
      resultCode: "NOT_ELIGIBLE",
    });
    return {
      ok: false,
      code: "NOT_ELIGIBLE",
      message:
        "Booking is not eligible for recovery (open offer, accepted offer, or cleaner already assigned).",
      httpStatus: 409,
    };
  }

  const engineResult = await recoverAssignmentForBooking(client, backend, bookingId);
  const bookingAfter = await backend.getBooking(bookingId);
  const statusAfter = bookingAfter?.status ?? booking.status;

  if (!engineResult.ok) {
    await auditAdminAssignmentRecovery(client, {
      bookingId,
      adminProfileId: user.profileId,
      reason: reasonCheck.reason,
      eligible: true,
      resultStatus: "error",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: statusAfter,
      engine: engineResult,
      resultCode: "ENGINE_ERROR",
    });
    return {
      ok: false,
      code: "ENGINE_ERROR",
      message: engineResult.message,
      httpStatus: 422,
    };
  }

  if (statusAfter === "confirmed") {
    await auditAdminAssignmentRecovery(client, {
      bookingId,
      adminProfileId: user.profileId,
      reason: reasonCheck.reason,
      eligible: true,
      resultStatus: "still_confirmed",
      bookingStatusBefore: booking.status,
      bookingStatusAfter: statusAfter,
      engine: engineResult,
      resultCode: "STILL_CONFIRMED",
    });
    return {
      ok: false,
      code: "STILL_CONFIRMED",
      message:
        "Recovery ran but booking is still payment-confirmed. Check assignment context or runbook.",
      httpStatus: 422,
    };
  }

  const message =
    engineResult.outcome === "offered" && engineResult.idempotent
      ? "Offer already open. no duplicate offer created."
      : engineResult.outcome === "attention_required"
        ? "Recovery ran but no eligible cleaner was available."
        : "Assignment recovery succeeded.";

  await auditAdminAssignmentRecovery(client, {
    bookingId,
    adminProfileId: user.profileId,
    reason: reasonCheck.reason,
    eligible: true,
    resultStatus: "recovered",
    bookingStatusBefore: booking.status,
    bookingStatusAfter: statusAfter,
    engine: engineResult,
    idempotent: engineResult.idempotent,
  });

  return {
    ok: true,
    status: "recovered",
    bookingId,
    bookingStatus: statusAfter,
    outcome: engineResult.outcome,
    offerId: engineResult.offerId,
    cleanerId: engineResult.cleanerId,
    idempotent: engineResult.idempotent,
    message,
  };
}
