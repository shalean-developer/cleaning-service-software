import { isCleanerOperationalForDispatch } from "./dispatchEligibility";
import type { CleanerLifecycleSnapshot } from "./operationalState";

export type CleanerProfileCompletenessInput = {
  lifecycle: CleanerLifecycleSnapshot;
  phone: string | null;
  serviceAreaSlugs: string[];
  capabilitySlugs: string[];
  availabilityWindowCount: number;
  /** When true, payout rail is configured (optional for dispatch). */
  payoutReady?: boolean;
};

export type CleanerProfileCompletenessSection =
  | "onboarding"
  | "phone"
  | "service_areas"
  | "capabilities"
  | "availability"
  | "payout";

export type CleanerProfileCompletenessResult = {
  completionPercent: number;
  missingSections: CleanerProfileCompletenessSection[];
  /** True when lifecycle is active and required profile sections are present. */
  dispatchReady: boolean;
  /** Human-readable blockers for admin / cleaner UX. */
  blockers: string[];
};

const SECTION_WEIGHTS: { key: CleanerProfileCompletenessSection; weight: number }[] = [
  { key: "onboarding", weight: 30 },
  { key: "phone", weight: 10 },
  { key: "service_areas", weight: 15 },
  { key: "capabilities", weight: 20 },
  { key: "availability", weight: 25 },
];

function hasOnboardingComplete(lifecycle: CleanerLifecycleSnapshot): boolean {
  return lifecycle.onboardingCompletedAt != null;
}

/**
 * Canonical profile completeness for admin, cleaner onboarding UX, and future /apply.
 */
export function evaluateCleanerProfileCompleteness(
  input: CleanerProfileCompletenessInput,
  now: Date = new Date(),
): CleanerProfileCompletenessResult {
  const missingSections: CleanerProfileCompletenessSection[] = [];
  const blockers: string[] = [];

  if (!hasOnboardingComplete(input.lifecycle)) {
    missingSections.push("onboarding");
    blockers.push("Missing onboarding completion");
  }

  if (!input.phone?.trim()) {
    missingSections.push("phone");
    blockers.push("Missing phone number");
  }

  if (input.serviceAreaSlugs.length === 0) {
    missingSections.push("service_areas");
    blockers.push("Missing service areas");
  }

  if (input.capabilitySlugs.length === 0) {
    missingSections.push("capabilities");
    blockers.push("Missing service capabilities");
  }

  if (input.availabilityWindowCount === 0) {
    missingSections.push("availability");
    blockers.push("Missing availability schedule");
  }

  if (input.payoutReady === false) {
    missingSections.push("payout");
    blockers.push("Payout setup incomplete");
  }

  let earned = 0;
  for (const { key, weight } of SECTION_WEIGHTS) {
    if (!missingSections.includes(key)) {
      earned += weight;
    }
  }

  const lifecycleOperational = isCleanerOperationalForDispatch(input.lifecycle, now);
  const profileConfigured =
    missingSections.filter((s) => s !== "onboarding" && s !== "payout").length === 0;

  const dispatchReady = lifecycleOperational && profileConfigured;

  if (!lifecycleOperational && hasOnboardingComplete(input.lifecycle) && !input.lifecycle.active) {
    blockers.push("Account is inactive");
  }

  if (!dispatchReady && blockers.length === 0) {
    blockers.push("Profile not dispatch-ready");
  }

  return {
    completionPercent: earned,
    missingSections,
    dispatchReady,
    blockers,
  };
}
