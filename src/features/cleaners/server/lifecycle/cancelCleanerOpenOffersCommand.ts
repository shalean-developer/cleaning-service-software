import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  cancelCleanerOpenOffers,
  type CancelCleanerOpenOffersResult,
} from "./cancelCleanerOpenOffers";
import {
  buildLifecycleIdempotencyKey,
  cleanerRowToLifecycleState,
  finalizeLifecycleCommand,
  gatherLifecycleAffectedCounts,
  loadCleanerRow,
  resolveIdempotentLifecycleReplay,
} from "./lifecycleCommandSupport";
import type {
  CancelCleanerOpenOffersParams,
  CleanerLifecycleCommandResult,
} from "./types";

export async function runCancelCleanerOpenOffersCommand(
  params: CancelCleanerOpenOffersParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CleanerLifecycleCommandResult & { cancel?: CancelCleanerOpenOffersResult }> {
  const row = await loadCleanerRow(client, params.cleanerId);
  if (!row) {
    const result = await finalizeLifecycleCommand(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "open_offers_cancelled",
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
    return result;
  }

  const beforeState = cleanerRowToLifecycleState(row);
  const idempotencyKey = buildLifecycleIdempotencyKey(
    "open_offers_cancelled",
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
  if (replay) return { ...replay, cancel: { openOffersCancelled: 0, offersExamined: 0 } };

  const cancel = await cancelCleanerOpenOffers(client, {
    cleanerId: params.cleanerId,
    adminProfileId: params.adminProfileId,
    reason: params.reason,
  });

  if (cancel.openOffersCancelled === 0 && cancel.offersExamined === 0) {
    const result = await finalizeLifecycleCommand(client, {
      cleanerId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "open_offers_cancelled",
      outcome: "idempotent",
      reason: params.reason,
      beforeState,
      afterState: beforeState,
      affectedCounts: await gatherLifecycleAffectedCounts(client, params.cleanerId, 0),
      idempotencyKey,
      message: "No open offers to cancel.",
    });
    return { ...result, cancel };
  }

  const result = await finalizeLifecycleCommand(client, {
    cleanerId: params.cleanerId,
    adminProfileId: params.adminProfileId,
    action: "open_offers_cancelled",
    outcome: cancel.openOffersCancelled > 0 ? "success" : "idempotent",
    reason: params.reason,
    beforeState,
    afterState: beforeState,
    affectedCounts: await gatherLifecycleAffectedCounts(
      client,
      params.cleanerId,
      cancel.openOffersCancelled,
    ),
    idempotencyKey,
    message:
      cancel.openOffersCancelled > 0
        ? `Cancelled ${cancel.openOffersCancelled} open offer(s).`
        : "No open offers to cancel.",
  });
  return { ...result, cancel };
}
