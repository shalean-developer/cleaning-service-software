import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { resolveCleanerOperationalState } from "./operationalState";
import {
  buildLifecycleIdempotencyKey,
  cleanerRowToLifecycleState,
  finalizeLifecycleCommand,
  gatherLifecycleAffectedCounts,
  isCleanerArchived,
  loadCleanerRow,
  resolveIdempotentLifecycleReplay,
  updateCleanerLifecycleRow,
} from "./lifecycleCommandSupport";
import type {
  CleanerLifecycleCommandResult,
  CompleteCleanerOnboardingParams,
} from "./types";

export async function completeCleanerOnboarding(
  params: CompleteCleanerOnboardingParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CleanerLifecycleCommandResult> {
  const row = await loadCleanerRow(client, params.cleanerId);
  if (!row) {
    return finalizeLifecycleCommand(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "onboarding_completed",
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
    "onboarding_completed",
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
      action: "onboarding_completed",
      outcome: "rejected",
      reason: params.lifecycleReason,
      beforeState,
      afterState: beforeState,
      affectedCounts: await gatherLifecycleAffectedCounts(client, params.cleanerId, 0),
      idempotencyKey,
      code: "CLEANER_ARCHIVED",
      message: "Archived cleaners cannot complete onboarding.",
    });
  }

  if (row.onboarding_completed_at != null) {
    return finalizeLifecycleCommand(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "onboarding_completed",
      outcome: "idempotent",
      reason: params.lifecycleReason,
      beforeState,
      afterState: beforeState,
      affectedCounts: await gatherLifecycleAffectedCounts(client, params.cleanerId, 0),
      idempotencyKey,
      message: "Cleaner onboarding is already complete.",
    });
  }

  const completedAt = new Date().toISOString();
  const updated = await updateCleanerLifecycleRow(client, params.cleanerId, {
    onboarding_completed_at: completedAt,
    active: true,
    lifecycle_reason: params.lifecycleReason?.trim() ?? row.lifecycle_reason,
  });
  const afterState = cleanerRowToLifecycleState(updated);

  const operationalState = resolveCleanerOperationalState({
    active: updated.active,
    suspendedAt: updated.suspended_at,
    deletedAt: updated.deleted_at,
    onboardingCompletedAt: updated.onboarding_completed_at,
  });

  return finalizeLifecycleCommand(client, {
    cleanerId: params.cleanerId,
    adminProfileId: params.adminProfileId,
    action: "onboarding_completed",
    outcome: "success",
    reason: params.lifecycleReason,
    beforeState,
    afterState,
    affectedCounts: await gatherLifecycleAffectedCounts(client, params.cleanerId, 0),
    idempotencyKey,
    message:
      operationalState === "active"
        ? "Onboarding completed. Cleaner is now active."
        : "Onboarding completed.",
  });
}
