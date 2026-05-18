import "server-only";

import { isTeamOffersEnabled } from "@/features/assignments/server/teamOffersConfig";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { loadRosterRowForCleaner } from "@/features/dashboards/server/cleanerTeamJobVisibility";
import { isTeamEarningsEnabled } from "@/features/earnings/server/teamEarningsConfig";
import { recordSupportTeamEarningsForBooking } from "@/features/earnings/server/recordSupportTeamEarnings";
import { trueUpTeamEarningsForBooking } from "@/features/earnings/server/teamEarningsTrueUp";
import type { BookingStatus } from "@/features/bookings/server/types";
import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SUPPORT_PARTICIPATION_BOOKING_STATUSES: BookingStatus[] = [
  "in_progress",
  "completed",
];

export type SupportParticipationResult =
  | { ok: true; rosterId: string; status: "completed"; idempotent: boolean }
  | { ok: false; code: string; message: string; httpStatus?: number };

/**
 * NF-7F: Support cleaner confirms roster participation only.
 * Does not invoke MARK_BOOKING_COMPLETED or change bookings.status.
 */
export async function markSupportParticipationCompleted(
  user: CurrentUser,
  bookingId: string,
  supportNote?: string | null,
): Promise<SupportParticipationResult> {
  if (user.role !== "cleaner") {
    return { ok: false, code: "FORBIDDEN", message: "Cleaners only.", httpStatus: 403 };
  }

  if (!isTeamOffersEnabled()) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      message: "Team support participation is not enabled.",
      httpStatus: 404,
    };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Supabase not configured.",
      httpStatus: 503,
    };
  }

  const scope = await resolveActorScope(client, user.profileId, user.role);
  if (!scope.actingCleanerId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Cleaner profile not linked.",
      httpStatus: 403,
    };
  }

  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: bookingError.message,
      httpStatus: 500,
    };
  }
  if (!booking) {
    return { ok: false, code: "NOT_FOUND", message: "Job not found.", httpStatus: 404 };
  }

  const rosterRow = await loadRosterRowForCleaner(client, bookingId, scope.actingCleanerId);
  if (!rosterRow || rosterRow.role !== "support") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Only an accepted support cleaner on this roster may confirm participation.",
      httpStatus: 403,
    };
  }

  if (rosterRow.status === "completed") {
    return {
      ok: true,
      rosterId: rosterRow.id,
      status: "completed",
      idempotent: true,
    };
  }

  if (rosterRow.status !== "accepted") {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: "Support participation can only be confirmed from an accepted roster slot.",
      httpStatus: 400,
    };
  }

  if (
    !SUPPORT_PARTICIPATION_BOOKING_STATUSES.includes(booking.status as BookingStatus)
  ) {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: "Participation can be confirmed once the job is in progress or completed by the lead cleaner.",
      httpStatus: 400,
    };
  }

  const trimmedNote =
    typeof supportNote === "string" && supportNote.trim().length > 0
      ? supportNote.trim().slice(0, 500)
      : null;

  const ts = new Date().toISOString();
  const { error: updateError } = await client
    .from("booking_cleaners")
    .update({
      status: "completed",
      support_completed_at: ts,
      support_note: trimmedNote,
      updated_at: ts,
    })
    .eq("id", rosterRow.id)
    .eq("cleaner_id", scope.actingCleanerId)
    .eq("role", "support");

  if (updateError) {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: updateError.message,
      httpStatus: 500,
    };
  }

  if (isTeamEarningsEnabled()) {
    const backend = createBookingCommandBackend();
    const earnings = await recordSupportTeamEarningsForBooking(
      backend,
      booking,
      scope.actingCleanerId,
    );
    if (!earnings.ok && earnings.code !== "INVALID_STATE") {
      return {
        ok: false,
        code: earnings.code,
        message: earnings.message,
        httpStatus: 500,
      };
    }
    const trueUp = await trueUpTeamEarningsForBooking(backend, booking);
    if (!trueUp.ok) {
      return {
        ok: false,
        code: trueUp.code,
        message: trueUp.message,
        httpStatus: 500,
      };
    }
  }

  return {
    ok: true,
    rosterId: rosterRow.id,
    status: "completed",
    idempotent: false,
  };
}
