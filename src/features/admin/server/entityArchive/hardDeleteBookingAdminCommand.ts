import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  buildAdminArchiveIdempotencyKey,
  requireNonEmptyArchiveReason,
  resolveIdempotentAdminArchiveReplay,
} from "./adminArchiveSupport";
import {
  assessBookingHardDeleteEligibility,
  loadBookingForHardDelete,
  summarizeBookingHardDeleteBlockedReason,
} from "./bookingHardDeleteQueries";
import { recordAdminDeleteAudit } from "./recordAdminDeleteAudit";
import type { AdminArchiveCommandResult } from "./types";

export type HardDeleteBookingAdminParams = {
  bookingId: string;
  adminProfileId: string;
  reason: string;
  idempotencyKey?: string | null;
};

export async function hardDeleteBookingAdminCommand(
  params: HardDeleteBookingAdminParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AdminArchiveCommandResult> {
  const action = "hard_delete" as const;
  const reasonError = requireNonEmptyArchiveReason(params.reason, "hardDeleteBookingAdminCommand");
  if (reasonError) {
    const auditId = await safeRecordAudit(client, {
      entityType: "booking",
      entityId: params.bookingId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "rejected",
      reason: params.reason,
      blockedReason: reasonError,
      metadata: { phase: "pre_delete" },
    });
    return {
      ok: false,
      outcome: "rejected",
      entityType: "booking",
      entityId: params.bookingId,
      code: "INVALID_PAYLOAD",
      message: reasonError,
      auditId,
      blockedReason: reasonError,
    };
  }

  const booking = await loadBookingForHardDelete(client, params.bookingId);
  if (!booking) {
    const auditId = await safeRecordAudit(client, {
      entityType: "booking",
      entityId: params.bookingId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "rejected",
      reason: params.reason,
      blockedReason: "Booking not found.",
      metadata: { phase: "pre_delete" },
    });
    return {
      ok: false,
      outcome: "rejected",
      entityType: "booking",
      entityId: params.bookingId,
      code: "BOOKING_NOT_FOUND",
      message: "Booking not found.",
      auditId,
      blockedReason: "Booking not found.",
    };
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

  const eligibility = await assessBookingHardDeleteEligibility(client, booking);
  const blockedSummary = summarizeBookingHardDeleteBlockedReason(eligibility.blockedReasons);

  const preDeleteAuditId = await safeRecordAudit(client, {
    entityType: "booking",
    entityId: params.bookingId,
    adminProfileId: params.adminProfileId,
    action,
    outcome: eligibility.hardDeleteAllowed ? "success" : "rejected",
    reason: params.reason,
    blockedReason: blockedSummary,
    metadata: {
      phase: "pre_delete",
      hardDeleteAllowed: eligibility.hardDeleteAllowed,
      blockers: eligibility.blockers,
      blockedReasons: eligibility.blockedReasons,
    },
    idempotencyKey: `${idempotencyKey}:pre`,
  });

  if (!eligibility.hardDeleteAllowed) {
    return {
      ok: false,
      outcome: "rejected",
      entityType: "booking",
      entityId: params.bookingId,
      code: "HARD_DELETE_NOT_ALLOWED",
      message:
        blockedSummary ??
        "This booking cannot be permanently deleted. Archive it instead.",
      auditId: preDeleteAuditId,
      blockedReason: blockedSummary,
      affectedCounts: {
        settledPaymentCount: eligibility.blockers.settledPaymentCount,
        earningLineCount: eligibility.blockers.earningLineCount,
      },
    };
  }

  const { error: rpcError } = await client.rpc("admin_hard_delete_booking", {
    p_booking_id: params.bookingId,
  });

  if (rpcError) {
    const failedAuditId = await safeRecordAudit(client, {
      entityType: "booking",
      entityId: params.bookingId,
      adminProfileId: params.adminProfileId,
      action,
      outcome: "failed",
      reason: params.reason,
      blockedReason: rpcError.message,
      metadata: { phase: "post_delete", preDeleteAuditId, error: rpcError.message },
      idempotencyKey,
    });
    return {
      ok: false,
      outcome: "failed",
      entityType: "booking",
      entityId: params.bookingId,
      code: "PERSISTENCE_ERROR",
      message: rpcError.message,
      auditId: failedAuditId,
      blockedReason: rpcError.message,
    };
  }

  const postDeleteAuditId = await safeRecordAudit(client, {
    entityType: "booking",
    entityId: params.bookingId,
    adminProfileId: params.adminProfileId,
    action,
    outcome: "success",
    reason: params.reason,
    metadata: {
      phase: "post_delete",
      preDeleteAuditId,
      permanentlyDeleted: true,
      blockers: eligibility.blockers,
    },
    idempotencyKey,
  });

  return {
    ok: true,
    outcome: "success",
    entityType: "booking",
    entityId: params.bookingId,
    auditId: postDeleteAuditId,
    message: "Booking permanently deleted.",
  };
}

async function safeRecordAudit(
  client: SupabaseClient<Database>,
  input: Parameters<typeof recordAdminDeleteAudit>[1],
): Promise<string | null> {
  try {
    return await recordAdminDeleteAudit(client, input);
  } catch {
    return null;
  }
}
