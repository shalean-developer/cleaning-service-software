import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  assessBookingArchiveBlockers,
  bookingArchiveBlocked,
  loadBookingForArchive,
} from "./bookingArchiveQueries";
import { cancelBookingOpenOffers } from "./cancelBookingOpenOffers";
import {
  buildAdminArchiveIdempotencyKey,
  finalizeAdminArchiveCommand,
  requireNonEmptyArchiveReason,
  resolveIdempotentAdminArchiveReplay,
} from "./adminArchiveSupport";
import type { AdminArchiveCommandResult, AdminDeleteAction } from "./types";

export type ArchiveBookingAdminParams = {
  bookingId: string;
  adminProfileId: string;
  reason: string;
  action?: AdminDeleteAction;
  idempotencyKey?: string | null;
};

export async function archiveBookingAdminCommand(
  params: ArchiveBookingAdminParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminArchiveCommandResult> {
  const action = "archive";
  const reasonError = requireNonEmptyArchiveReason(params.reason, "archiveBookingAdminCommand");
  if (reasonError) {
    return finalizeAdminArchiveCommand(client, {
      entityType: "booking",
      entityId: params.bookingId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "rejected",
      reason: params.reason,
      blockedReason: reasonError,
      code: "INVALID_PAYLOAD",
      message: reasonError,
    });
  }

  const booking = await loadBookingForArchive(client, params.bookingId);
  if (!booking) {
    return finalizeAdminArchiveCommand(client, {
      entityType: "booking",
      entityId: params.bookingId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "rejected",
      reason: params.reason,
      blockedReason: "Booking not found.",
      code: "BOOKING_NOT_FOUND",
      message: "Booking not found.",
    });
  }

  const idempotencyKey = buildAdminArchiveIdempotencyKey(
    "booking",
    action,
    params.bookingId,
    params.adminProfileId,
    params.idempotencyKey,
  );

  const replay = await resolveIdempotentAdminArchiveReplay(
    client,
    idempotencyKey,
    "booking",
    params.bookingId,
  );
  if (replay) return replay;

  if (booking.deleted_at) {
    return finalizeAdminArchiveCommand(client, {
      entityType: "booking",
      entityId: params.bookingId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "idempotent",
      reason: params.reason,
      idempotencyKey,
      message: "Booking is already archived.",
    });
  }

  const blockers = await assessBookingArchiveBlockers(client, booking);

  if (bookingArchiveBlocked(blockers)) {
    const blockSummary =
      blockers.hasActiveAssignment
        ? "Booking has an active assignment."
        : "Cannot archive booking while it is assigned or in progress.";
    const blockedReason = blockSummary ?? "Booking has an active assignment.";
    return finalizeAdminArchiveCommand(client, {
      entityType: "booking",
      entityId: params.bookingId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "rejected",
      reason: params.reason,
      blockedReason,
      idempotencyKey,
      code: "ACTIVE_ASSIGNMENT_BLOCK",
      message: "Cannot archive booking while it is assigned or in progress.",
      metadata: { blockers },
    });
  }

  const cancelResult = await cancelBookingOpenOffers(client, {
    bookingId: params.bookingId,
    adminProfileId: params.adminProfileId,
    reason: params.reason,
  });

  const nowIso = new Date().toISOString();
  const { error: updateError } = await client
    .from("bookings")
    .update({
      deleted_at: nowIso,
      deleted_by_profile_id: params.adminProfileId,
      delete_reason: params.reason.trim(),
      updated_at: nowIso,
    })
    .eq("id", params.bookingId);

  if (updateError) {
    return finalizeAdminArchiveCommand(client, {
      entityType: "booking",
      entityId: params.bookingId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "failed",
      reason: params.reason,
      code: "PERSISTENCE_ERROR",
      message: updateError.message,
      idempotencyKey,
    });
  }

  return finalizeAdminArchiveCommand(client, {
    entityType: "booking",
    entityId: params.bookingId,
    adminProfileId: params.adminProfileId,
    action,
    outcome: "success",
    reason: params.reason,
    idempotencyKey,
    message: "Booking archived.",
    metadata: { blockers },
    affectedCounts: {
      openOffersCancelled: cancelResult.openOffersCancelled,
    },
  });
}
