import {
  evaluateOperationalDispatchGate,
  lifecycleSnapshotFromCandidate,
} from "../lifecycle/dispatchEligibility";
import type {
  CleanerCandidateRecord,
  CleanerEligibilityCode,
  EligibilityEvaluation,
  EligibilityQuery,
} from "../types";
import type { ParsedSlot } from "./slot";

function compareTime(a: string, b: string): number {
  return a.localeCompare(b);
}

function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isCleanerSuspended(
  suspendedAt: string | null,
  now: Date = new Date(),
): boolean {
  if (!suspendedAt) return false;
  const at = new Date(suspendedAt);
  return !Number.isNaN(at.getTime()) && at.getTime() <= now.getTime();
}

export function matchesServiceArea(
  cleanerAreas: string[],
  requestedArea: string,
): boolean {
  if (cleanerAreas.length === 0) return true;
  return cleanerAreas.includes(requestedArea);
}

export function matchesServiceCapability(
  capabilities: string[],
  serviceSlug: string,
): boolean {
  if (capabilities.length === 0) return false;
  return capabilities.includes(serviceSlug);
}

export function matchesAvailabilityWindow(
  parsedSlot: ParsedSlot,
  windows: CleanerCandidateRecord["availabilityWindows"],
): boolean {
  if (windows.length === 0) return false;

  const dayWindows = windows.filter((w) => w.dayOfWeek === parsedSlot.dayOfWeek);
  if (dayWindows.length === 0) return false;

  return dayWindows.some((w) => {
    const tz = w.timezone || parsedSlot.timezone;
    if (tz !== parsedSlot.timezone) {
      // MVP: only match when window timezone equals slot timezone
      return false;
    }
    return (
      compareTime(parsedSlot.localTime, w.startTime) >= 0 &&
      compareTime(parsedSlot.localTime, w.endTime) <= 0
    );
  });
}

export function hasTimeOffConflict(
  parsedSlot: ParsedSlot,
  blocks: CleanerCandidateRecord["timeOffBlocks"],
): boolean {
  return blocks.some((block) =>
    intervalsOverlap(
      parsedSlot.start,
      parsedSlot.end,
      new Date(block.startAt),
      new Date(block.endAt),
    ),
  );
}

export function evaluateCleanerEligibility(
  candidate: CleanerCandidateRecord,
  query: EligibilityQuery,
  parsedSlot: ParsedSlot,
  conflictingCleanerIds: ReadonlySet<string>,
): EligibilityEvaluation {
  const operationalBlock = evaluateOperationalDispatchGate(
    lifecycleSnapshotFromCandidate(candidate),
  );
  if (operationalBlock) {
    return operationalBlock;
  }

  if (!matchesServiceCapability(candidate.serviceSlugs, query.serviceSlug)) {
    return {
      eligible: false,
      code: "no_service_capability",
      message: "Cleaner cannot perform this service type.",
    };
  }

  if (!matchesServiceArea(candidate.serviceAreas, query.areaSlug)) {
    return {
      eligible: false,
      code: "outside_service_area",
      message: "Cleaner does not serve this area.",
    };
  }

  if (!matchesAvailabilityWindow(parsedSlot, candidate.availabilityWindows)) {
    return {
      eligible: false,
      code: "outside_availability_window",
      message: "Cleaner is not available at this date and time.",
    };
  }

  if (hasTimeOffConflict(parsedSlot, candidate.timeOffBlocks)) {
    return {
      eligible: false,
      code: "time_off",
      message: "Cleaner is on time off for this slot.",
    };
  }

  if (conflictingCleanerIds.has(candidate.cleanerId)) {
    return {
      eligible: false,
      code: "schedule_conflict",
      message: "Cleaner already has a booking during this time.",
    };
  }

  return {
    eligible: true,
    code: "active",
    message: "Available for this booking.",
  };
}

export const BOOKING_CONFLICT_STATUSES = [
  "assigned",
  "in_progress",
  "confirmed",
  "pending_assignment",
] as const;

export function eligibilityCodeToStatus(
  evaluation: EligibilityEvaluation,
): "eligible" | "ineligible" {
  return evaluation.eligible ? "eligible" : "ineligible";
}

export type { CleanerEligibilityCode };
