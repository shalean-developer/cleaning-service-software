import { isCleanerSuspended } from "../eligibility/evaluate";

/** Inputs required to resolve cleaner operational lifecycle state (read-only). */
export type CleanerLifecycleSnapshot = {
  active: boolean;
  suspendedAt: string | null;
  deletedAt: string | null;
  onboardingCompletedAt: string | null;
};

export type CleanerOperationalState =
  | "onboarding"
  | "active"
  | "inactive"
  | "suspended"
  | "archived";

/**
 * Resolves the operational lifecycle state for a cleaner row.
 * Priority: archived → suspended → onboarding → inactive → active.
 */
export function resolveCleanerOperationalState(
  row: CleanerLifecycleSnapshot,
  now: Date = new Date(),
): CleanerOperationalState {
  if (row.deletedAt != null) {
    return "archived";
  }

  if (isCleanerSuspended(row.suspendedAt, now)) {
    return "suspended";
  }

  if (row.onboardingCompletedAt == null) {
    return "onboarding";
  }

  if (!row.active) {
    return "inactive";
  }

  return "active";
}
