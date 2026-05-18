import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  buildLifecycleIdempotencyKey,
  cleanerRowToLifecycleState,
  finalizeLifecycleCommand,
  gatherLifecycleAffectedCounts,
  isCleanerArchived,
  isCleanerSuspendedNow,
  loadCleanerRow,
  resolveIdempotentLifecycleReplay,
  updateCleanerLifecycleRow,
} from "./lifecycleCommandSupport";
import type { CleanerLifecycleCommandResult, UnsuspendCleanerParams } from "./types";

export async function unsuspendCleaner(
  params: UnsuspendCleanerParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CleanerLifecycleCommandResult> {
  const row = await loadCleanerRow(client, params.cleanerId);
  if (!row) {
    return finalizeLifecycleCommand(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "unsuspended",
      outcome: "rejected",
      reason: params.lifecycleReason,
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
    "unsuspended",
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
      action: "unsuspended",
      outcome: "rejected",
      reason: params.lifecycleReason,
      beforeState,
      afterState: beforeState,
      affectedCounts: await gatherLifecycleAffectedCounts(client, params.cleanerId, 0),
      idempotencyKey,
      code: "CLEANER_ARCHIVED",
      message: "Archived cleaners cannot be unsuspended.",
    });
  }

  if (!row.suspended_at && !row.suspension_ends_at) {
    return finalizeLifecycleCommand(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "unsuspended",
      outcome: "idempotent",
      reason: params.lifecycleReason,
      beforeState,
      afterState: beforeState,
      affectedCounts: await gatherLifecycleAffectedCounts(client, params.cleanerId, 0),
      idempotencyKey,
      message: "Cleaner is not suspended.",
    });
  }

  const shouldActivate = params.setActive === true || row.active;
  const updated = await updateCleanerLifecycleRow(client, params.cleanerId, {
    suspended_at: null,
    suspension_ends_at: null,
    active: shouldActivate,
    lifecycle_reason: params.lifecycleReason?.trim() ?? row.lifecycle_reason,
  });
  const afterState = cleanerRowToLifecycleState(updated);

  const message =
    shouldActivate && !row.active
      ? "Cleaner unsuspended and activated."
      : isCleanerSuspendedNow(row)
        ? "Cleaner unsuspended."
        : "Cleaner suspension cleared.";

  return finalizeLifecycleCommand(client, {
    cleanerId: params.cleanerId,
    adminProfileId: params.adminProfileId,
    action: "unsuspended",
    outcome: "success",
    reason: params.lifecycleReason,
    beforeState,
    afterState,
    affectedCounts: await gatherLifecycleAffectedCounts(client, params.cleanerId, 0),
    idempotencyKey,
    message,
  });
}
