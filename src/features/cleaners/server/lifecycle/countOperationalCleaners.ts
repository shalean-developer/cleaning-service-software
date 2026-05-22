import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isCleanerSuspended } from "../eligibility/evaluate";
import { resolveCleanerOperationalState } from "./operationalState";

/**
 * Counts cleaners in the operational "active" lifecycle state (onboarding complete, not suspended/archived, active=true).
 * Excludes onboarding, inactive, suspended, and archived from workforce metrics.
 */
export async function countOperationalCleaners(
  client: SupabaseClient<Database>,
  now: Date = new Date(),
): Promise<number> {
  const { data, error } = await client
    .from("cleaners")
    .select("active, suspended_at, deleted_at, onboarding_completed_at");

  if (error) throw new Error(error.message);

  let count = 0;
  for (const row of data ?? []) {
    const state = resolveCleanerOperationalState(
      {
        active: row.active,
        suspendedAt: row.suspended_at,
        deletedAt: row.deleted_at,
        onboardingCompletedAt: row.onboarding_completed_at,
      },
      now,
    );
    if (state === "active" && !isCleanerSuspended(row.suspended_at, now)) {
      count += 1;
    }
  }
  return count;
}
