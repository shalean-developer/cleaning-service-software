import "server-only";

import {
  evaluateCleanerEligibility,
  isCleanerSuspended,
} from "@/features/cleaners/server/eligibility/evaluate";
import { listEligibleCleaners } from "@/features/cleaners/server/eligibility/listEligibleCleaners";
import { pickBestAvailable } from "@/features/cleaners/server/eligibility/rank";
import { parseBookingSlot } from "@/features/cleaners/server/eligibility/slot";
import {
  loadCleanerCandidates,
  loadConflictingCleanerIds,
} from "@/features/cleaners/server/repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import type { ServiceSlug } from "@/features/pricing/server/types";
import type { AssignmentContext } from "./types";

export async function isCleanerEligibleForAssignment(
  client: SupabaseClient<Database>,
  context: AssignmentContext,
  cleanerId: string,
): Promise<boolean> {
  const candidates = await loadCleanerCandidates(client);
  const candidate = candidates.find((c) => c.cleanerId === cleanerId);
  if (!candidate || isCleanerSuspended(candidate.suspendedAt)) {
    return false;
  }

  const slot = parseBookingSlot(
    {
      scheduledStart: context.scheduledStart,
      scheduledEnd: context.scheduledEnd,
    },
    context.scheduleTimezone,
  );
  if (!slot) return false;

  const conflicts = await loadConflictingCleanerIds(
    client,
    context.scheduledStart,
    context.scheduledEnd,
    context.bookingId,
  );

  const evaluation = evaluateCleanerEligibility(
    candidate,
    {
      serviceSlug: context.serviceSlug as ServiceSlug,
      areaSlug: context.areaSlug,
      slot: {
        scheduledStart: context.scheduledStart,
        scheduledEnd: context.scheduledEnd,
      },
    },
    slot,
    conflicts,
  );

  return evaluation.eligible;
}

export async function pickBestEligibleCleanerId(
  client: SupabaseClient<Database>,
  context: AssignmentContext,
): Promise<string | null> {
  const candidates = await loadCleanerCandidates(client);
  const conflicts = await loadConflictingCleanerIds(
    client,
    context.scheduledStart,
    context.scheduledEnd,
    context.bookingId,
  );

  const listed = listEligibleCleaners({
    candidates,
    query: {
      serviceSlug: context.serviceSlug as ServiceSlug,
      areaSlug: context.areaSlug,
      slot: {
        scheduledStart: context.scheduledStart,
        scheduledEnd: context.scheduledEnd,
      },
    },
    conflictingCleanerIds: conflicts,
    pricingInput: context.pricingInput,
  });

  if ("ok" in listed) return null;
  const best = pickBestAvailable(listed.cleaners);
  return best?.cleanerId ?? null;
}
