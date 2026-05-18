import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { cancelCleanerOpenOffers } from "./cancelCleanerOpenOffers";
import {
  buildLifecycleIdempotencyKey,
  cleanerRowToLifecycleState,
  finalizeLifecycleCommand,
  gatherLifecycleAffectedCounts,
  isCleanerArchived,
  isCleanerSuspendedNow,
  loadCleanerRow,
  requireNonEmptyReason,
  resolveIdempotentLifecycleReplay,
  updateCleanerLifecycleRow,
} from "./lifecycleCommandSupport";
import type { CleanerLifecycleCommandResult, DeactivateCleanerParams } from "./types";

export async function deactivateCleaner(
  params: DeactivateCleanerParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CleanerLifecycleCommandResult> {
  const reasonError = requireNonEmptyReason(params.reason, "deactivateCleaner");
  if (reasonError) {
    return finalizeLifecycleCommand(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "deactivated",
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
      action: "deactivated",
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
    "deactivated",
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
      action: "deactivated",
      outcome: "rejected",
      reason: params.reason,
      beforeState,
      afterState: beforeState,
      affectedCounts: await gatherLifecycleAffectedCounts(client, params.cleanerId, 0),
      idempotencyKey,
      code: "CLEANER_ARCHIVED",
      message: "Archived cleaners cannot be deactivated.",
    });
  }

  if (!row.active && !isCleanerSuspendedNow(row)) {
    return finalizeLifecycleCommand(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "deactivated",
      outcome: "idempotent",
      reason: params.reason,
      beforeState,
      afterState: beforeState,
      affectedCounts: await gatherLifecycleAffectedCounts(client, params.cleanerId, 0),
      idempotencyKey,
      message: "Cleaner is already inactive.",
    });
  }

  const cancelResult = await cancelCleanerOpenOffers(client, {
    cleanerId: params.cleanerId,
    adminProfileId: params.adminProfileId,
    reason: params.reason,
  });

  const updated = await updateCleanerLifecycleRow(client, params.cleanerId, {
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
    action: "deactivated",
    outcome: "success",
    reason: params.reason,
    beforeState,
    afterState,
    affectedCounts,
    idempotencyKey,
    message: "Cleaner deactivated.",
  });
}
