import type { CleanerEligibilityCode, EligibilityEvaluation } from "../types";
import {
  resolveCleanerOperationalState,
  type CleanerLifecycleSnapshot,
  type CleanerOperationalState,
} from "./operationalState";

/** Maps a cleaner candidate row to the lifecycle snapshot used by operational state resolution. */
export function lifecycleSnapshotFromCandidate(candidate: {
  active: boolean;
  suspendedAt: string | null;
  deletedAt?: string | null;
  onboardingCompletedAt: string | null;
}): CleanerLifecycleSnapshot {
  return {
    active: candidate.active,
    suspendedAt: candidate.suspendedAt,
    deletedAt: candidate.deletedAt ?? null,
    onboardingCompletedAt: candidate.onboardingCompletedAt,
  };
}

/** True only when the cleaner may enter dispatch pools, offers, and assignment eligibility. */
export function isCleanerOperationalForDispatch(
  snapshot: CleanerLifecycleSnapshot,
  now: Date = new Date(),
): boolean {
  return resolveCleanerOperationalState(snapshot, now) === "active";
}

const OPERATIONAL_BLOCK_MESSAGES: Record<
  Exclude<CleanerOperationalState, "active">,
  { code: CleanerEligibilityCode; message: string }
> = {
  archived: {
    code: "archived",
    message: "Cleaner is archived.",
  },
  suspended: {
    code: "suspended",
    message: "Cleaner is suspended.",
  },
  onboarding: {
    code: "onboarding",
    message: "Cleaner has not completed onboarding.",
  },
  inactive: {
    code: "inactive",
    message: "Cleaner is not active.",
  },
};

/**
 * Operational gate before slot/capability checks.
 * Returns null when the cleaner may proceed to scheduling eligibility rules.
 */
export function evaluateOperationalDispatchGate(
  snapshot: CleanerLifecycleSnapshot,
  now: Date = new Date(),
): EligibilityEvaluation | null {
  const state = resolveCleanerOperationalState(snapshot, now);
  if (state === "active") {
    return null;
  }
  const block = OPERATIONAL_BLOCK_MESSAGES[state];
  return {
    eligible: false,
    code: block.code,
    message: block.message,
  };
}
