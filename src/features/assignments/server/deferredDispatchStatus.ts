import type { BookingStatus } from "@/features/bookings/server/types";
import { DEFERRED_DISPATCH_OVERDUE_GRACE_MINUTES } from "./constants";
import {
  daysUntilDispatch,
  isAssignmentDeferred,
  shouldRunAssignmentNow,
} from "./computeAssignmentDispatchAt";

export type DeferredDispatchPhase =
  | "not_applicable"
  | "awaiting_dispatch_window"
  | "ready_for_dispatch"
  | "dispatch_overdue";

export const DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE =
  "Your booking is confirmed. We'll assign your cleaner closer to the service date.";

export const DEFERRED_ASSIGNMENT_ADMIN_AWAITING_COPY =
  "Payment confirmed. Cleaner assignment will begin closer to the service date.";

export const DEFERRED_ASSIGNMENT_ADMIN_READY_COPY =
  "Booking is ready for cleaner assignment. Cron should dispatch shortly.";

export const DEFERRED_ASSIGNMENT_ADMIN_OVERDUE_COPY =
  "Assignment dispatch is overdue. Check cron or manually dispatch.";

export type DeferredDispatchStatus = {
  phase: DeferredDispatchPhase;
  assignmentDispatchAt: string | null;
  daysUntilDispatch: number | null;
  hoursUntilDispatch: number | null;
  hoursOverdue: number | null;
  scheduledStart: string | null;
  adminLabel: string | null;
  adminOperationalCopy: string | null;
  customerMessage: string | null;
  /** True only for dispatch_overdue. normal deferred bookings must not surface as failed. */
  operationalAttentionRequired: boolean;
};

function hoursUntil(iso: string, now: Date): number {
  const targetMs = Date.parse(iso);
  if (Number.isNaN(targetMs)) return 0;
  const diffMs = targetMs - now.getTime();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (60 * 60 * 1000));
}

function hoursSince(iso: string, now: Date): number {
  const targetMs = Date.parse(iso);
  if (Number.isNaN(targetMs)) return 0;
  const diffMs = now.getTime() - targetMs;
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (60 * 60 * 1000));
}

function isPastDispatchOverdueGrace(
  assignmentDispatchAt: string,
  now: Date,
  overdueGraceMinutes: number,
): boolean {
  const dispatchMs = Date.parse(assignmentDispatchAt);
  if (Number.isNaN(dispatchMs)) return false;
  return now.getTime() >= dispatchMs + overdueGraceMinutes * 60_000;
}

export function resolveDeferredDispatchStatus(input: {
  bookingStatus: BookingStatus;
  assignmentDispatchAt: string | null | undefined;
  scheduledStart?: string | null;
  hasOpenOffer?: boolean;
  hasAcceptedOffer?: boolean;
  hasCleaner?: boolean;
  now?: Date;
  overdueGraceMinutes?: number;
}): DeferredDispatchStatus {
  const now = input.now ?? new Date();
  const dispatchAt = input.assignmentDispatchAt ?? null;
  const overdueGraceMinutes =
    input.overdueGraceMinutes ?? DEFERRED_DISPATCH_OVERDUE_GRACE_MINUTES;

  const empty: DeferredDispatchStatus = {
    phase: "not_applicable",
    assignmentDispatchAt: dispatchAt,
    daysUntilDispatch: null,
    hoursUntilDispatch: null,
    hoursOverdue: null,
    scheduledStart: input.scheduledStart ?? null,
    adminLabel: null,
    adminOperationalCopy: null,
    customerMessage: null,
    operationalAttentionRequired: false,
  };

  if (
    input.bookingStatus !== "confirmed" ||
    !dispatchAt ||
    input.hasCleaner ||
    input.hasOpenOffer ||
    input.hasAcceptedOffer
  ) {
    return empty;
  }

  if (isAssignmentDeferred(dispatchAt, now)) {
    return {
      phase: "awaiting_dispatch_window",
      assignmentDispatchAt: dispatchAt,
      daysUntilDispatch: daysUntilDispatch(dispatchAt, now),
      hoursUntilDispatch: hoursUntil(dispatchAt, now),
      hoursOverdue: null,
      scheduledStart: input.scheduledStart ?? null,
      adminLabel: "Awaiting dispatch window",
      adminOperationalCopy: DEFERRED_ASSIGNMENT_ADMIN_AWAITING_COPY,
      customerMessage: DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE,
      operationalAttentionRequired: false,
    };
  }

  if (shouldRunAssignmentNow(dispatchAt, now)) {
    if (isPastDispatchOverdueGrace(dispatchAt, now, overdueGraceMinutes)) {
      return {
        phase: "dispatch_overdue",
        assignmentDispatchAt: dispatchAt,
        daysUntilDispatch: 0,
        hoursUntilDispatch: 0,
        hoursOverdue: hoursSince(dispatchAt, now),
        scheduledStart: input.scheduledStart ?? null,
        adminLabel: "Dispatch overdue",
        adminOperationalCopy: DEFERRED_ASSIGNMENT_ADMIN_OVERDUE_COPY,
        customerMessage: null,
        operationalAttentionRequired: true,
      };
    }

    return {
      phase: "ready_for_dispatch",
      assignmentDispatchAt: dispatchAt,
      daysUntilDispatch: 0,
      hoursUntilDispatch: 0,
      hoursOverdue: null,
      scheduledStart: input.scheduledStart ?? null,
      adminLabel: "Ready for dispatch",
      adminOperationalCopy: DEFERRED_ASSIGNMENT_ADMIN_READY_COPY,
      customerMessage: null,
      operationalAttentionRequired: false,
    };
  }

  return empty;
}

/** True while booking is intentionally waiting before the dispatch window opens. */
export function isDeferredDispatchExemptFromRecovery(input: {
  assignmentDispatchAt: string | null | undefined;
  now?: Date;
}): boolean {
  return isAssignmentDeferred(input.assignmentDispatchAt, input.now);
}

/**
 * True after dispatch_at but before overdue grace. cron should dispatch; not a failure yet.
 */
export function isDeferredDispatchInReadyGrace(input: {
  assignmentDispatchAt: string | null | undefined;
  now?: Date;
  overdueGraceMinutes?: number;
}): boolean {
  const dispatchAt = input.assignmentDispatchAt;
  if (dispatchAt == null || dispatchAt === "") return false;
  const now = input.now ?? new Date();
  if (isAssignmentDeferred(dispatchAt, now)) return false;
  if (!shouldRunAssignmentNow(dispatchAt, now)) return false;
  const overdueGraceMinutes =
    input.overdueGraceMinutes ?? DEFERRED_DISPATCH_OVERDUE_GRACE_MINUTES;
  return !isPastDispatchOverdueGrace(dispatchAt, now, overdueGraceMinutes);
}

/** Deferred bookings must not surface as dispatch-not-started until overdue grace elapses. */
export function isDeferredDispatchFailureExempt(input: {
  assignmentDispatchAt: string | null | undefined;
  now?: Date;
  overdueGraceMinutes?: number;
}): boolean {
  return (
    isDeferredDispatchExemptFromRecovery(input) ||
    isDeferredDispatchInReadyGrace(input)
  );
}
