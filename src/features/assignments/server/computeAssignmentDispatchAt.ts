import { DEFAULT_ASSIGNMENT_DISPATCH_LEAD_DAYS } from "../dispatchAtConstants";

/**
 * assignment_dispatch_at = scheduled_start instant minus leadDays calendar days.
 * Uses UTC instants so results are deterministic regardless of server locale.
 */
export function computeAssignmentDispatchAt(
  scheduledStart: string,
  leadDays: number = DEFAULT_ASSIGNMENT_DISPATCH_LEAD_DAYS,
): string {
  const startMs = Date.parse(scheduledStart);
  if (Number.isNaN(startMs)) {
    throw new Error(`Invalid scheduled_start: ${scheduledStart}`);
  }
  if (!Number.isFinite(leadDays) || leadDays < 0) {
    throw new Error(`Invalid leadDays: ${leadDays}`);
  }
  const leadMs = leadDays * 24 * 60 * 60 * 1000;
  return new Date(startMs - leadMs).toISOString();
}

/** True when post-payment assignment should run now (null or past dispatch window). */
export function shouldRunAssignmentNow(
  assignmentDispatchAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (assignmentDispatchAt == null || assignmentDispatchAt === "") return true;
  const dispatchMs = Date.parse(assignmentDispatchAt);
  if (Number.isNaN(dispatchMs)) return true;
  return now.getTime() >= dispatchMs;
}

/** True when booking is intentionally waiting for the dispatch window. */
export function isAssignmentDeferred(
  assignmentDispatchAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (assignmentDispatchAt == null || assignmentDispatchAt === "") return false;
  const dispatchMs = Date.parse(assignmentDispatchAt);
  if (Number.isNaN(dispatchMs)) return false;
  return now.getTime() < dispatchMs;
}

export function daysUntilDispatch(
  assignmentDispatchAt: string,
  now: Date = new Date(),
): number {
  const dispatchMs = Date.parse(assignmentDispatchAt);
  if (Number.isNaN(dispatchMs)) return 0;
  const diffMs = dispatchMs - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}
