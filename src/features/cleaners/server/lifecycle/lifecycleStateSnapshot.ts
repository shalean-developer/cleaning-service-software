import type { CleanerRow } from "@/lib/database/types";
import type { CleanerLifecycleStateJson } from "./types";

export function cleanerRowToLifecycleState(row: CleanerRow): CleanerLifecycleStateJson {
  return {
    active: row.active,
    suspended_at: row.suspended_at,
    suspension_ends_at: row.suspension_ends_at,
    deleted_at: row.deleted_at,
    onboarding_completed_at: row.onboarding_completed_at,
    lifecycle_reason: row.lifecycle_reason,
  };
}

export function lifecycleStatesEqual(
  a: CleanerLifecycleStateJson,
  b: CleanerLifecycleStateJson,
): boolean {
  return (
    a.active === b.active &&
    a.suspended_at === b.suspended_at &&
    a.suspension_ends_at === b.suspension_ends_at &&
    a.deleted_at === b.deleted_at &&
    a.onboarding_completed_at === b.onboarding_completed_at &&
    a.lifecycle_reason === b.lifecycle_reason
  );
}
