import {
  formatAdminBookingOpsReference,
  type AdminBookingOpsCardModel,
  buildAdminBookingOpsCardModel,
} from "@/features/dashboards/adminBookingsOperationsDisplay";
import type { AdminHomeDispatchAlert } from "@/features/dashboards/adminHomeOperationsDisplay";
import { queueCountByKey } from "@/features/dashboards/adminHomeDisplay";
import type { AdminOperationalQueueCountItem } from "@/features/dashboards/server/adminOperationalQueueCounts";
import type {
  AdminAssignmentQueueItem,
  AdminBookingListItem,
} from "@/features/dashboards/server/types";
import type { AdminOverviewTodayCounts } from "@/features/dashboards/server/adminOverviewTypes";

export type DispatchLaneId = "morning" | "midday" | "afternoon";

export type DispatchLaneStatus = "matched" | "matching" | "conflict" | "unassigned";

export type DispatchOrchestrationSummary = {
  confirmed: number;
  cleanersOnDuty: number;
  matching: number;
  attention: number;
  slotsToday: number;
  pending: number;
};

export type DispatchOrchestrationLaneSection = {
  id: DispatchLaneId;
  label: string;
  window: string;
  jobs: DispatchOrchestrationJobCard[];
};

export type DispatchOrchestrationJobCard = {
  bookingId: string;
  href: string;
  serviceTitle: string;
  bookingRef: string;
  laneStatus: DispatchLaneStatus;
  statusLabel: string;
  customerLine: string;
  scheduleTime: string;
  durationLabel: string;
  addressLabel: string;
  cleanerLabel: string;
  cleanerInitials: string | null;
  alertTag: string | null;
  showRecurringBadge: boolean;
};

export type DispatchSuggestedMatch = {
  label: string;
  bookingRef: string;
  href: string;
} | null;

export const DISPATCH_LANE_DEFINITIONS: readonly {
  id: DispatchLaneId;
  label: string;
  window: string;
}[] = [
  { id: "morning", label: "Morning", window: "08:00–11:00" },
  { id: "midday", label: "Midday", window: "11:00–14:00" },
  { id: "afternoon", label: "Afternoon", window: "14:00–17:00" },
] as const;

function cleanerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

/** Map hour in Johannesburg to a dispatch lane (design windows). */
export function resolveDispatchLaneId(scheduledStart: string | undefined): DispatchLaneId {
  if (!scheduledStart) return "morning";
  const hour = Number.parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Johannesburg",
      hour: "numeric",
      hour12: false,
    }).format(new Date(scheduledStart)),
    10,
  );
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  return "afternoon";
}

export function resolveDispatchLaneStatus(
  booking: Pick<
    AdminBookingListItem,
    | "status"
    | "cleanerLabel"
    | "assignmentVisibilityKey"
    | "assignmentAttention"
    | "deferredDispatch"
  >,
  queueItem?: AdminAssignmentQueueItem,
): DispatchLaneStatus {
  const key = booking.assignmentVisibilityKey ?? booking.assignmentAttention ?? "";
  const reason = (queueItem?.assignmentReason ?? "").toLowerCase();

  if (reason.includes("conflict") || reason.includes("overlap")) {
    return "conflict";
  }
  if (queueItem?.opsAdminRequired || queueItem?.manualInterventionNeeded) {
    return "conflict";
  }
  if (booking.cleanerLabel && ["confirmed", "assigned", "in_progress"].includes(booking.status)) {
    return "matched";
  }
  if (
    booking.status === "pending_assignment" ||
    key === "finding_cleaner" ||
    key === "offer_sent" ||
    key === "needs_assignment" ||
    (queueItem?.openOffers.length ?? 0) > 0
  ) {
    return "matching";
  }
  if (booking.deferredDispatch?.phase === "dispatch_overdue") {
    return "matching";
  }
  return "unassigned";
}

function laneStatusLabel(status: DispatchLaneStatus): string {
  switch (status) {
    case "matched":
      return "Matched";
    case "matching":
      return "Matching";
    case "conflict":
      return "Conflict";
    default:
      return "Unassigned";
  }
}

function primaryAlertTag(
  status: DispatchLaneStatus,
  ops: AdminBookingOpsCardModel,
): string | null {
  if (status === "conflict") return "Schedule overlap";
  if (ops.alertLabels.includes("No cleaner matched")) return "No cleaner matched";
  if (ops.alertLabels.includes("Late arrival risk")) return "Awaiting confirm";
  return ops.alertLabels[0] ?? null;
}

export function buildDispatchOrchestrationJobCard(
  booking: AdminBookingListItem,
  queueItem?: AdminAssignmentQueueItem,
): DispatchOrchestrationJobCard {
  const ops = buildAdminBookingOpsCardModel(booking);
  const laneStatus = resolveDispatchLaneStatus(booking, queueItem);
  const cleanerLabel =
    laneStatus === "matched" || booking.cleanerLabel
      ? ops.cleanerLabel
      : "Awaiting match";
  const initials =
    booking.cleanerLabel && laneStatus === "matched"
      ? cleanerInitials(booking.cleanerLabel)
      : null;

  return {
    bookingId: booking.id,
    href: ops.href,
    serviceTitle: ops.serviceTitle,
    bookingRef: ops.bookingRef,
    laneStatus,
    statusLabel: laneStatusLabel(laneStatus),
    customerLine: ops.customerLine,
    scheduleTime: `${ops.scheduleWhen} · ${ops.scheduleTime}`,
    durationLabel: ops.durationLabel,
    addressLabel: ops.addressLabel,
    cleanerLabel,
    cleanerInitials: initials,
    alertTag: primaryAlertTag(laneStatus, ops),
    showRecurringBadge: ops.showRecurringBadge,
  };
}

export function buildDispatchOrchestrationSummary(input: {
  today: AdminOverviewTodayCounts;
  queues: readonly AdminOperationalQueueCountItem[];
  workQueueCount: number;
  laneJobCount: number;
}): DispatchOrchestrationSummary {
  const matching = queueCountByKey(input.queues, "needs_assignment");
  const attention = queueCountByKey(input.queues, "assignment_attention");

  return {
    confirmed: input.today.bookingsConfirmed,
    cleanersOnDuty: input.today.cleanersActive,
    matching,
    attention: Math.max(attention, input.workQueueCount),
    slotsToday: input.laneJobCount,
    pending: matching + attention,
  };
}

export function groupDispatchJobsIntoLanes(
  jobs: DispatchOrchestrationJobCard[],
  scheduledStarts: Map<string, string | undefined>,
): DispatchOrchestrationLaneSection[] {
  const byLane: Record<DispatchLaneId, DispatchOrchestrationJobCard[]> = {
    morning: [],
    midday: [],
    afternoon: [],
  };

  for (const job of jobs) {
    const laneId = resolveDispatchLaneId(scheduledStarts.get(job.bookingId));
    byLane[laneId].push(job);
  }

  return DISPATCH_LANE_DEFINITIONS.map((lane) => ({
    id: lane.id,
    label: lane.label,
    window: lane.window,
    jobs: byLane[lane.id],
  }));
}

export function buildDispatchSuggestedMatch(input: {
  attention: readonly AdminAssignmentQueueItem[];
  todayBookings: readonly AdminBookingListItem[];
}): DispatchSuggestedMatch {
  const unmatched = input.attention.find((item) => item.openOffers.length === 0);
  if (!unmatched) {
    const queueUnassigned = input.todayBookings.find((b) => !b.cleanerLabel);
    if (!queueUnassigned) return null;
    const offer = input.attention
      .flatMap((a) => a.openOffers)
      .find((o) => o.cleanerName);
    if (!offer?.cleanerName) return null;
    return {
      label: `${offer.cleanerName} · suggested for ${formatAdminBookingOpsReference(queueUnassigned.id)}`,
      bookingRef: formatAdminBookingOpsReference(queueUnassigned.id),
      href: `/admin/bookings/${queueUnassigned.id}`,
    };
  }

  const offer = unmatched.openOffers[0];
  if (offer?.cleanerName) {
    return {
      label: `${offer.cleanerName} · open offer · ${formatAdminBookingOpsReference(unmatched.bookingId)}`,
      bookingRef: formatAdminBookingOpsReference(unmatched.bookingId),
      href: `/admin/bookings/${unmatched.bookingId}`,
    };
  }

  return {
    label: `${unmatched.serviceLabel} · ${unmatched.scheduleLabel}`,
    bookingRef: formatAdminBookingOpsReference(unmatched.bookingId),
    href: `/admin/bookings/${unmatched.bookingId}`,
  };
}

export function mapDispatchAlertCta(alert: AdminHomeDispatchAlert): string {
  if (alert.cta.toLowerCase().includes("dispatch")) return "Open dispatch";
  if (alert.cta.toLowerCase().includes("diagnostic")) return "Diagnostics";
  if (alert.cta.toLowerCase().includes("review")) return "Resolve";
  if (alert.cta.toLowerCase().includes("view")) return "Confirm";
  if (alert.cta.toLowerCase().includes("open")) return "Open dispatch";
  return alert.cta;
}
