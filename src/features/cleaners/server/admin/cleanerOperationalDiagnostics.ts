import "server-only";

import { evaluateCleanerEligibility } from "../eligibility/evaluate";
import { parseBookingSlot } from "../eligibility/slot";
import {
  isCleanerOperationalForDispatch,
  lifecycleSnapshotFromCandidate,
} from "../lifecycle/dispatchEligibility";
import { evaluateCleanerProfileCompleteness } from "../lifecycle/profileCompleteness";
import { resolveCleanerOperationalState } from "../lifecycle/operationalState";
import type { CleanerLifecycleSnapshot } from "../lifecycle/operationalState";
import type { ServiceSlug } from "@/features/pricing/server/types";

export type CleanerOperationalDiagnostics = {
  operationalState: ReturnType<typeof resolveCleanerOperationalState>;
  lifecycleDispatchEligible: boolean;
  assignmentEligibilityCode: string | null;
  assignmentEligibilityMessage: string | null;
  profileCompleteness: ReturnType<typeof evaluateCleanerProfileCompleteness>;
  warnings: string[];
  canReceiveBookings: boolean;
};

const PROBE_SLOT = {
  scheduledStart: "2026-06-02T08:00:00.000Z",
  scheduledEnd: "2026-06-02T10:00:00.000Z",
};

function buildWarnings(
  completeness: ReturnType<typeof evaluateCleanerProfileCompleteness>,
  lifecycle: CleanerLifecycleSnapshot,
  operationalState: ReturnType<typeof resolveCleanerOperationalState>,
): string[] {
  const warnings: string[] = [];

  if (operationalState === "onboarding" || lifecycle.onboardingCompletedAt == null) {
    warnings.push("Missing onboarding completion");
  }
  if (completeness.missingSections.includes("capabilities")) {
    warnings.push("Missing service capabilities");
  }
  if (completeness.missingSections.includes("availability")) {
    warnings.push("Missing availability schedule");
  }
  if (completeness.missingSections.includes("service_areas")) {
    warnings.push("Missing service areas");
  }
  if (!completeness.dispatchReady) {
    warnings.push("Cannot receive bookings");
  }

  return warnings;
}

export function buildCleanerOperationalDiagnostics(input: {
  lifecycle: CleanerLifecycleSnapshot;
  phone: string | null;
  capabilities: ServiceSlug[];
  serviceAreaSlugs: string[];
  availabilityWindowCount: number;
  primaryAreaSlug?: string | null;
  now?: Date;
}): CleanerOperationalDiagnostics {
  const now = input.now ?? new Date();
  const operationalState = resolveCleanerOperationalState(input.lifecycle, now);
  const lifecycleDispatchEligible = isCleanerOperationalForDispatch(
    input.lifecycle,
    now,
  );

  const completeness = evaluateCleanerProfileCompleteness({
    lifecycle: input.lifecycle,
    phone: input.phone,
    serviceAreaSlugs: input.serviceAreaSlugs,
    capabilitySlugs: input.capabilities,
    availabilityWindowCount: input.availabilityWindowCount,
  });

  const areaSlug = input.primaryAreaSlug ?? input.serviceAreaSlugs[0] ?? "cape-town";
  const serviceSlug = input.capabilities[0] ?? "regular-cleaning";
  const parsedSlot = parseBookingSlot(PROBE_SLOT);

  let assignmentEligibilityCode: string | null = null;
  let assignmentEligibilityMessage: string | null = null;

  if (parsedSlot) {
    const evaluation = evaluateCleanerEligibility(
      {
        cleanerId: "00000000-0000-4000-8000-000000000001",
        profileId: "probe",
        phone: input.phone,
        displayName: "Probe",
        active: input.lifecycle.active,
        suspendedAt: input.lifecycle.suspendedAt,
        deletedAt: input.lifecycle.deletedAt,
        onboardingCompletedAt: input.lifecycle.onboardingCompletedAt,
        averageRating: null,
        hiredAt: "2024-01-01T00:00:00.000Z",
        serviceAreas: input.serviceAreaSlugs,
        serviceSlugs: input.capabilities,
        availabilityWindows:
          input.availabilityWindowCount > 0
            ? [
                {
                  dayOfWeek: 1,
                  startTime: "08:00:00",
                  endTime: "18:00:00",
                  timezone: "Africa/Johannesburg",
                },
              ]
            : [],
        timeOffBlocks: [],
      },
      {
        serviceSlug: serviceSlug as ServiceSlug,
        areaSlug,
        slot: PROBE_SLOT,
      },
      parsedSlot,
      new Set(),
    );
    assignmentEligibilityCode = evaluation.code;
    assignmentEligibilityMessage = evaluation.message;
  }

  const warnings = buildWarnings(completeness, input.lifecycle, operationalState);

  return {
    operationalState,
    lifecycleDispatchEligible,
    assignmentEligibilityCode,
    assignmentEligibilityMessage,
    profileCompleteness: completeness,
    warnings,
    canReceiveBookings: completeness.dispatchReady && lifecycleDispatchEligible,
  };
}

export { lifecycleSnapshotFromCandidate };
