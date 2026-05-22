import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isOfferOpenForOps } from "./buildOfferExpiry";
import { auditAdminDeferredDispatchNow } from "@/features/admin/server/adminOperationalAuditSidecar";
import {
  ADMIN_RECOVERY_REASON_MAX_LENGTH,
  ADMIN_RECOVERY_REASON_MIN_LENGTH,
  validateAdminRecoveryReason,
} from "./adminAssignmentRecovery";
import { listOffersForBooking } from "./offerRepository";
import { computeDeferredDispatchNowEligible } from "./deferredDispatchNowEligibility";
import { runAssignmentAfterPayment } from "./runAssignmentAfterPayment";
import type { RunAssignmentResult } from "./types";

export { computeDeferredDispatchNowEligible } from "./deferredDispatchNowEligibility";

export type AdminDeferredDispatchResultStatus =
  | "dispatched"
  | "already_dispatched"
  | "not_eligible"
  | "still_confirmed"
  | "error";

export type AdminDeferredDispatchNowSuccess = {
  ok: true;
  status: AdminDeferredDispatchResultStatus;
  bookingId: string;
  bookingStatus: string;
  outcome?: string;
  offerId?: string | null;
  cleanerId?: string | null;
  idempotent?: boolean;
  message: string;
};

export type AdminDeferredDispatchNowFailure = {
  ok: false;
  code: string;
  message: string;
  httpStatus: number;
};

export type AdminDeferredDispatchNowResult =
  | AdminDeferredDispatchNowSuccess
  | AdminDeferredDispatchNowFailure;

const ALREADY_DISPATCHED_STATUSES = new Set([
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

export function logAdminDeferredDispatchNow(payload: {
  bookingId: string;
  adminProfileId: string;
  reason: string;
  eligible: boolean;
  resultStatus: AdminDeferredDispatchResultStatus;
  bookingStatusAfter: string | null;
  engine?: RunAssignmentResult | null;
}): void {
  console.warn(
    JSON.stringify({
      event: "admin_deferred_dispatch_now",
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

export async function runAdminDeferredDispatchNow(
  user: CurrentUser,
  bookingId: string,
  input: { reason: string },
): Promise<AdminDeferredDispatchNowResult> {
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

  const { data: booking, error: bookErr } = await client
    .from("bookings")
    .select("id, status, cleaner_id, assignment_dispatch_at")
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
  const hasPaidPayment = (payments ?? []).some((p) => p.status === "paid");
  const openOfferCount = offers.filter((o) => isOfferOpenForOps(o)).length;

  if (booking.status !== "confirmed") {
    if (ALREADY_DISPATCHED_STATUSES.has(booking.status)) {
      await auditAdminDeferredDispatchNow(client, {
        bookingId,
        adminProfileId: user.profileId,
        reason: reasonCheck.reason,
        eligible: false,
        resultStatus: "already_dispatched",
        bookingStatusBefore: booking.status,
        bookingStatusAfter: booking.status,
        engine: null,
        idempotent: true,
      });
      return {
        ok: true,
        status: "already_dispatched",
        bookingId,
        bookingStatus: booking.status,
        message: "Assignment has already progressed past deferred dispatch.",
      };
    }

    if (booking.status === "pending_assignment" && openOfferCount === 0) {
      await auditAdminDeferredDispatchNow(client, {
        bookingId,
        adminProfileId: user.profileId,
        reason: reasonCheck.reason,
        eligible: false,
        resultStatus: "already_dispatched",
        bookingStatusBefore: booking.status,
        bookingStatusAfter: booking.status,
        engine: null,
        idempotent: true,
      });
      return {
        ok: true,
        status: "already_dispatched",
        bookingId,
        bookingStatus: booking.status,
        message: "Assignment dispatch has already started for this booking.",
      };
    }

    await auditAdminDeferredDispatchNow(client, {
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
      message: `Dispatch now requires status confirmed (got ${booking.status}).`,
      httpStatus: 409,
    };
  }

  const eligible = computeDeferredDispatchNowEligible({
    bookingStatus: booking.status,
    hasAssignedCleaner: Boolean(booking.cleaner_id),
    hasPaidPayment,
    assignmentDispatchAt: booking.assignment_dispatch_at,
    openOfferCount,
  });

  if (!eligible) {
    const message = !hasPaidPayment
      ? "No paid payment on this booking."
      : !booking.assignment_dispatch_at
        ? "Booking has no deferred dispatch window (not a deferred assignment)."
        : openOfferCount > 0
          ? "Dispatch now is not available while an offer is open."
          : booking.cleaner_id
            ? "A cleaner is already assigned."
            : "Booking is not eligible for dispatch now.";

    await auditAdminDeferredDispatchNow(client, {
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
      message,
      httpStatus: 409,
    };
  }

  const engineResult = await runAssignmentAfterPayment(client, backend, bookingId);
  const bookingAfter = await backend.getBooking(bookingId);
  const statusAfter = bookingAfter?.status ?? booking.status;

  if (!engineResult.ok) {
    await auditAdminDeferredDispatchNow(client, {
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
    await auditAdminDeferredDispatchNow(client, {
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
        "Dispatch ran but booking is still payment-confirmed. Check assignment context or cron.",
      httpStatus: 422,
    };
  }

  const message =
    engineResult.outcome === "offered" && engineResult.idempotent
      ? "Offer already open. no duplicate offer created."
      : engineResult.outcome === "attention_required"
        ? "Dispatch ran but no eligible cleaner was available."
        : "Deferred assignment dispatch succeeded.";

  await auditAdminDeferredDispatchNow(client, {
    bookingId,
    adminProfileId: user.profileId,
    reason: reasonCheck.reason,
    eligible: true,
    resultStatus: "dispatched",
    bookingStatusBefore: booking.status,
    bookingStatusAfter: statusAfter,
    engine: engineResult,
    idempotent: engineResult.idempotent,
  });

  return {
    ok: true,
    status: "dispatched",
    bookingId,
    bookingStatus: statusAfter,
    outcome: engineResult.outcome,
    offerId: engineResult.offerId,
    cleanerId: engineResult.cleanerId,
    idempotent: engineResult.idempotent,
    message,
  };
}

export {
  ADMIN_RECOVERY_REASON_MIN_LENGTH,
  ADMIN_RECOVERY_REASON_MAX_LENGTH,
};
