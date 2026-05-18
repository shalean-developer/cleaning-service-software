import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { cancelCleanerOpenOffers } from "./cancelCleanerOpenOffers";
import { countActiveBookingsForCleaner } from "./lifecycleQueries";
import {
  buildLifecycleIdempotencyKey,
  cleanerRowToLifecycleState,
  finalizeLifecycleCommand,
  gatherLifecycleAffectedCounts,
  isCleanerArchived,
  loadCleanerRow,
  requireNonEmptyReason,
  resolveIdempotentLifecycleReplay,
  updateCleanerLifecycleRow,
} from "./lifecycleCommandSupport";
import type { ArchiveCleanerParams, CleanerLifecycleCommandResult } from "./types";

export async function archiveCleaner(
  params: ArchiveCleanerParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CleanerLifecycleCommandResult> {
  const reasonError = requireNonEmptyReason(params.reason, "archiveCleaner");
  if (reasonError) {
    return finalizeLifecycleCommand(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "archived",
      outcome: "rejected",
      reason: params.reason,
      beforeState: {
        active: true,
        suspended_at: null,
        suspension_ends_at: null,
        deleted_at: null,
        onboarding_completed_at: null,
        lifecycle_reason: null,
      },
      afterState: {
        active: true,
        suspended_at: null,
        suspension_ends_at: null,
        deleted_at: null,
        onboarding_completed_at: null,
        lifecycle_reason: null,
      },
      affectedCounts: { openOffersCancelled: 0, activeBookingsFound: 0, pendingEarningsFound: 0 },
      code: "INVALID_PAYLOAD",
      message: reasonError,
    });
  }

  const row = await loadCleanerRow(client, params.cleanerId);
  if (!row) {
    return finalizeLifecycleCommand(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "archived",
      outcome: "rejected",
      reason: params.reason,
      beforeState: {
        active: false,
        suspended_at: null,
        suspension_ends_at: null,
        deleted_at: null,
        onboarding_completed_at: null,
        lifecycle_reason: null,
      },
      afterState: {
        active: false,
        suspended_at: null,
        suspension_ends_at: null,
        deleted_at: null,
        onboarding_completed_at: null,
        lifecycle_reason: null,
      },
      affectedCounts: { openOffersCancelled: 0, activeBookingsFound: 0, pendingEarningsFound: 0 },
      code: "CLEANER_NOT_FOUND",
      message: "Cleaner not found.",
    });
  }

  const beforeState = cleanerRowToLifecycleState(row);
  const idempotencyKey = buildLifecycleIdempotencyKey(
    "archived",
    params.cleanerId,
    params.adminProfileId,
    params.idempotencyKey,
  );

  const replay = await resolveIdempotentLifecycleReplay(
    client,
    idempotencyKey,
    params.cleanerId,
    beforeState,
  );
  if (replay) return replay;

  if (isCleanerArchived(row)) {
    return finalizeLifecycleCommand(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "archived",
      outcome: "idempotent",
      reason: params.reason,
      beforeState,
      afterState: beforeState,
      affectedCounts: await gatherLifecycleAffectedCounts(client, params.cleanerId, 0),
      idempotencyKey,
      message: "Cleaner is already archived.",
    });
  }

  const activeBookingsFound = await countActiveBookingsForCleaner(client, params.cleanerId);
  if (activeBookingsFound > 0) {
    const affectedCounts = await gatherLifecycleAffectedCounts(client, params.cleanerId, 0);
    return finalizeLifecycleCommand(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "archived",
      outcome: "rejected",
      reason: params.reason,
      beforeState,
      afterState: beforeState,
      affectedCounts: { ...affectedCounts, activeBookingsFound },
      idempotencyKey,
      code: "ACTIVE_BOOKINGS_BLOCK",
      message: "Cannot archive cleaner with assigned or in-progress bookings.",
    });
  }

  const cancelResult = await cancelCleanerOpenOffers(client, {
    cleanerId: params.cleanerId,
    adminProfileId: params.adminProfileId,
    reason: params.reason,
  });

  const nowIso = new Date().toISOString();
  const updated = await updateCleanerLifecycleRow(client, params.cleanerId, {
    deleted_at: nowIso,
    active: false,
    lifecycle_reason: params.lifecycleReason?.trim() || params.reason.trim(),
  });
  const afterState = cleanerRowToLifecycleState(updated);
  const affectedCounts = await gatherLifecycleAffectedCounts(
    client,
    params.cleanerId,
    cancelResult.openOffersCancelled,
  );

  return finalizeLifecycleCommand(client, {
    cleanerId: params.cleanerId,
    adminProfileId: params.adminProfileId,
    action: "archived",
    outcome: "success",
    reason: params.reason,
    beforeState,
    afterState,
    affectedCounts,
    idempotencyKey,
    message: "Cleaner archived.",
  });
}
