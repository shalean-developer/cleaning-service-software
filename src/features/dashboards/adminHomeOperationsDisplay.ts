import type { DeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import type { CronHealthSummary } from "@/features/dashboards/adminAssignmentsPageDisplay";
import {
  computeAdminHomeUrgentCount,
  queueCountByKey,
} from "@/features/dashboards/adminHomeDisplay";
import type { AdminOperationalQueueCountItem } from "@/features/dashboards/server/adminOperationalQueueCounts";
import type {
  AdminAssignmentQueueItem,
  AdminBookingListItem,
} from "@/features/dashboards/server/types";
import type { AdminPayoutSummary } from "@/features/earnings/server/payoutReadModel";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import type { BookingStatus } from "@/features/bookings/server/types";
import { scheduleStartToBookingDate } from "@/features/booking-wizard/bookingWindowConfig";
import { johannesburgCalendarDayKey } from "@/lib/datetime/johannesburgDay";
import type { AdminOverviewOperationalEvent } from "@/features/dashboards/server/adminOverviewOperationalEvents";
import { addDaysToDateString } from "@/features/booking-wizard/dateStringUtils";
import type {
  AdminOverviewRhythmCounts,
  AdminOverviewTodayCounts,
  AdminOverviewUpcomingContext,
} from "@/features/dashboards/server/adminOverviewTypes";

export type AdminHomeTodaySnapshot = {
  bookingsToday: number;
  bookingsConfirmed: number;
  bookingsDone: number;
  cleanersActive: number;
  revenueTodayCents: number;
  activeIssues: number;
};

export type AdminHomeWorkbenchRow = {
  id: string;
  issueType: string;
  title: string;
  meta: string;
  timeLabel: string;
  href: string;
  cta: string;
  tone: "warning" | "danger" | "info";
};

export type AdminHomeLiveFeedItem = {
  id: string;
  kind:
    | "assignment"
    | "confirmed"
    | "support"
    | "risk"
    | "completed"
    | "recurring"
    | "payment";
  title: string;
  detail: string;
  timeLabel: string;
  href: string;
  /** When false, feed row is informational only (archived audit without resolvable booking). */
  linkable?: boolean;
};

export type AdminHomeSnapshotPresentation = {
  summarySuffix?: string;
  bookingsFooter: string;
  cleanersFooter: string;
  revenueFooter: string;
  issuesFooter: string;
};

export type AdminHomeRhythmPresentation = {
  metrics: AdminHomeRhythmMetric[];
  emptyWindowHint?: string;
};

export type AdminHomeDispatchAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  href: string;
  cta: string;
};

export type AdminHomeSupportRow = {
  id: string;
  customerInitials: string;
  title: string;
  detail: string;
  timeLabel: string;
  priority: "high" | "medium" | "low";
  href: string;
};

export type AdminHomeRhythmMetric = {
  id: string;
  label: string;
  value: string;
  hint?: string;
};

export type AdminHomePayoutSummaryView = {
  payoutReadyCount: number;
  payoutReadyLabel: string;
  pendingReviewCents: number;
  weeklyReadyLabel: string;
  previewHref: string;
  /** False when payout summary failed to load (distinct from zero ready). */
  dataAvailable: boolean;
};

const COMPLETED_STATUSES: readonly BookingStatus[] = ["completed", "payout_ready", "paid_out"];

export type AdminHomeDisplayContext = {
  /** ISO timestamp from the server render — keeps “today” and relative labels stable. */
  referenceNow: string;
};

function resolveReferenceNow(context?: AdminHomeDisplayContext): Date {
  return context?.referenceNow ? new Date(context.referenceNow) : new Date();
}

function johannesburgDayKeyForContext(context?: AdminHomeDisplayContext): string {
  return johannesburgCalendarDayKey(resolveReferenceNow(context));
}

function isScheduledToday(
  scheduledStart: string | undefined,
  context?: AdminHomeDisplayContext,
): boolean {
  if (!scheduledStart) return false;
  return scheduleStartToBookingDate(scheduledStart) === johannesburgDayKeyForContext(context);
}

function formatTimeLabel(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Johannesburg",
  });
}

function formatRelativeTimeLabel(
  iso: string | undefined,
  context?: AdminHomeDisplayContext,
): string {
  if (!iso) return "—";
  const deltaMs = resolveReferenceNow(context).getTime() - new Date(iso).getTime();
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Johannesburg",
  });
}

function customerInitials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

/** Today metrics from canonical overview count queries (Johannesburg day). */
export function buildAdminHomeTodaySnapshotFromCounts(
  counts: AdminOverviewTodayCounts,
): AdminHomeTodaySnapshot {
  return {
    bookingsToday: counts.bookingsToday,
    bookingsConfirmed: counts.bookingsConfirmed,
    bookingsDone: counts.bookingsDone,
    cleanersActive: counts.cleanersActive,
    revenueTodayCents: counts.revenueTodayCents,
    activeIssues: 0,
  };
}

/** Presentation-only today metrics from a loaded bookings slice (tests / fallbacks). */
export function buildAdminHomeTodaySnapshot(
  bookings: readonly AdminBookingListItem[],
  context?: AdminHomeDisplayContext,
): AdminHomeTodaySnapshot {
  const today = bookings.filter((b) => isScheduledToday(b.scheduledStart, context));
  const confirmed = today.filter((b) => b.status === "confirmed").length;
  const done = today.filter((b) => COMPLETED_STATUSES.includes(b.status)).length;
  const cleaners = new Set(
    today.map((b) => b.cleanerLabel).filter((label): label is string => Boolean(label?.trim())),
  );

  const revenueTodayCents = today
    .filter((b) => COMPLETED_STATUSES.includes(b.status) || b.status === "confirmed")
    .reduce((sum, b) => sum + b.priceCents, 0);

  return buildAdminHomeTodaySnapshotFromCounts({
    bookingsToday: today.length,
    bookingsConfirmed: confirmed,
    bookingsDone: done,
    cleanersActive: cleaners.size,
    revenueTodayCents,
  });
}

export function withActiveIssuesCount(
  snapshot: AdminHomeTodaySnapshot,
  input: {
    queues: readonly AdminOperationalQueueCountItem[];
    cronSummary: CronHealthSummary | null;
    deferredDiagnostics: DeferredAssignmentDiagnostics | null;
  },
): AdminHomeTodaySnapshot {
  return {
    ...snapshot,
    activeIssues: computeAdminHomeUrgentCount(input),
  };
}

function upcomingDayLabel(scheduledStart: string, todayKey: string): string {
  const bookingDay = scheduleStartToBookingDate(scheduledStart);
  if (!bookingDay) return "upcoming";
  const tomorrowKey = addDaysToDateString(todayKey, 1);
  if (bookingDay === tomorrowKey) return "tomorrow";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(scheduledStart));
}

/** Snapshot card footers and summary helpers — does not change today metric values. */
export function buildAdminHomeSnapshotPresentation(input: {
  snapshot: AdminHomeTodaySnapshot;
  upcoming: AdminOverviewUpcomingContext | null;
  matchingPending: number;
  recurringActive: number;
}): AdminHomeSnapshotPresentation {
  const { snapshot, upcoming, matchingPending, recurringActive } = input;

  let summarySuffix: string | undefined;
  if (snapshot.bookingsToday === 0 && upcoming && upcoming.upcomingBookingsCount > 0) {
    const dayLabel = upcoming.nextUpcomingDayLabel ?? "upcoming";
    const countLabel =
      upcoming.upcomingBookingsCount === 1
        ? "1 upcoming"
        : `${upcoming.upcomingBookingsCount} upcoming`;
    summarySuffix = ` · ${countLabel} ${dayLabel}`;
  }

  const bookingsFooter = `${snapshot.bookingsConfirmed} confirmed · ${snapshot.bookingsDone} done`;

  const cleanersFooter =
    matchingPending > 0
      ? `${matchingPending} matching pending`
      : "Assigned on today's schedule";

  const revenueFooter = `${recurringActive} recurring active`;

  const issuesFooter = snapshot.activeIssues > 0 ? "Dispatch & SLA review" : "Queues clear";

  return {
    summarySuffix,
    bookingsFooter,
    cleanersFooter,
    revenueFooter,
    issuesFooter,
  };
}

export function formatUpcomingDayLabel(
  scheduledStart: string,
  todayKey: string,
): string {
  return upcomingDayLabel(scheduledStart, todayKey);
}

export function buildAdminHomeWorkbenchRows(
  attention: readonly AdminAssignmentQueueItem[],
  queues: readonly AdminOperationalQueueCountItem[],
  limit = 6,
  context?: AdminHomeDisplayContext,
): AdminHomeWorkbenchRow[] {
  const rows: AdminHomeWorkbenchRow[] = [];

  for (const item of attention) {
    rows.push({
      id: `attention-${item.bookingId}`,
      issueType: item.assignmentAttention,
      title: item.serviceLabel,
      meta: `${item.customerLabel} · ${item.scheduleLabel}`,
      timeLabel: formatRelativeTimeLabel(item.updatedAt, context),
      href: `/admin/bookings/${item.bookingId}`,
      cta: "Open dispatch",
      tone: item.opsAdminRequired ? "danger" : "warning",
    });
  }

  const paymentCount = queueCountByKey(queues, "payment_attention");
  if (paymentCount > 0 && rows.length < limit) {
    rows.push({
      id: "queue-payment",
      issueType: "Payment issues",
      title: `${paymentCount} payment failed`,
      meta: "Customer retry required",
      timeLabel: "Queue",
      href: "/admin/bookings?filter=payment_failed",
      cta: "View queue",
      tone: "danger",
    });
  }

  const needsAssignment = queueCountByKey(queues, "needs_assignment");
  if (needsAssignment > 0 && rows.length < limit) {
    rows.push({
      id: "queue-needs-assignment",
      issueType: "Cleaner assignment",
      title: `${needsAssignment} need assignment`,
      meta: "Paid bookings awaiting cleaner",
      timeLabel: "Queue",
      href: "/admin/bookings?filter=pending_assignment",
      cta: "Open dispatch",
      tone: "warning",
    });
  }

  return rows.slice(0, limit);
}

export function buildAdminHomeLiveFeedFromEvents(input: {
  events: readonly AdminOverviewOperationalEvent[];
  bookingLabels: ReadonlyMap<
    string,
    { customerLabel: string; serviceLabel: string; scheduleLabel: string }
  >;
  limit?: number;
  context?: AdminHomeDisplayContext;
}): AdminHomeLiveFeedItem[] {
  const limit = input.limit ?? 8;
  const items: AdminHomeLiveFeedItem[] = [];

  for (const event of input.events) {
    if (items.length >= limit) break;
    const bookingId = event.bookingId?.trim() || null;
    const labels = bookingId ? input.bookingLabels.get(bookingId) : undefined;
    const archived = !bookingId || !labels;

    const detailParts = archived
      ? [event.detail?.trim(), "Archived booking activity"].filter(Boolean)
      : [labels?.serviceLabel, labels?.customerLabel, event.detail].filter(
          (part): part is string => Boolean(part?.trim()),
        );

    items.push({
      id: event.id,
      kind: event.kind,
      title: event.title,
      detail: detailParts.join(" · ") || "Archived booking activity",
      timeLabel: formatRelativeTimeLabel(event.at, input.context),
      href: bookingId ? `/admin/bookings/${bookingId}` : "/admin/bookings",
      linkable: Boolean(bookingId),
    });
  }

  return items;
}

export function mergeAdminHomeLiveFeed(
  primary: readonly AdminHomeLiveFeedItem[],
  secondary: readonly AdminHomeLiveFeedItem[],
  limit = 8,
): AdminHomeLiveFeedItem[] {
  const seen = new Set<string>();
  const merged: AdminHomeLiveFeedItem[] = [];

  for (const item of [...primary, ...secondary]) {
    if (merged.length >= limit) break;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  return merged;
}

export function buildAdminHomeLiveFeed(input: {
  attention?: readonly AdminAssignmentQueueItem[];
  bookings?: readonly AdminBookingListItem[];
  limit?: number;
  context?: AdminHomeDisplayContext;
}): AdminHomeLiveFeedItem[] {
  const limit = input.limit ?? 8;
  const items: AdminHomeLiveFeedItem[] = [];
  const attention = input.attention ?? [];
  const bookings = input.bookings ?? [];

  for (const item of attention) {
    items.push({
      id: `feed-assignment-${item.bookingId}`,
      kind: "assignment",
      title: "Assignment needs attention",
      detail: `${item.serviceLabel} · ${item.customerLabel}`,
      timeLabel: formatRelativeTimeLabel(item.updatedAt, input.context),
      href: `/admin/bookings/${item.bookingId}`,
    });
  }

  for (const booking of bookings) {
    if (items.length >= limit) break;
    if (booking.status === "payment_failed") {
      items.push({
        id: `feed-payment-${booking.id}`,
        kind: "payment",
        title: "Payment attention",
        detail: `${booking.serviceLabel} · ${booking.customerLabel}`,
        timeLabel: formatRelativeTimeLabel(booking.updatedAt, input.context),
        href: `/admin/bookings/${booking.id}`,
      });
      continue;
    }
    if (booking.cleanerLabel && booking.status === "confirmed") {
      items.push({
        id: `feed-assigned-${booking.id}`,
        kind: "confirmed",
        title: "Cleaner assigned",
        detail: `${booking.cleanerLabel} · ${booking.serviceLabel}`,
        timeLabel: formatTimeLabel(booking.scheduledStart),
        href: `/admin/bookings/${booking.id}`,
      });
      continue;
    }
    if (booking.observation.teamSupportOps.coordinationStatus) {
      items.push({
        id: `feed-support-${booking.id}`,
        kind: "support",
        title: "Support coordination",
        detail: `${booking.customerLabel} · ${booking.serviceLabel}`,
        timeLabel: formatRelativeTimeLabel(booking.updatedAt, input.context),
        href: `/admin/bookings/${booking.id}`,
      });
      continue;
    }
    if (COMPLETED_STATUSES.includes(booking.status)) {
      items.push({
        id: `feed-done-${booking.id}`,
        kind: "completed",
        title: "Visit completed",
        detail: `${booking.serviceLabel} · ${booking.scheduleLabel}`,
        timeLabel: formatRelativeTimeLabel(booking.updatedAt, input.context),
        href: `/admin/bookings/${booking.id}`,
      });
    }
  }

  return items.slice(0, limit);
}

export function buildAdminHomeDispatchAlerts(input: {
  queues: readonly AdminOperationalQueueCountItem[];
  attention: readonly AdminAssignmentQueueItem[];
  deferredDiagnostics: DeferredAssignmentDiagnostics | null;
  limit?: number;
}): AdminHomeDispatchAlert[] {
  const limit = input.limit ?? 5;
  const alerts: AdminHomeDispatchAlert[] = [];
  const seenBookingAlerts = new Set<string>();

  const assignmentCount = queueCountByKey(input.queues, "assignment_attention");
  if (assignmentCount > 0) {
    alerts.push({
      id: "dispatch-assignment",
      severity: "warning",
      title: "No cleaner matched",
      description: `${assignmentCount} booking${assignmentCount === 1 ? "" : "s"} need dispatch attention`,
      href: "/admin/assignments",
      cta: "Open dispatch",
    });
  }

  const dispatchNotStarted = queueCountByKey(input.queues, "dispatch_not_started");
  if (dispatchNotStarted > 0) {
    alerts.push({
      id: "dispatch-not-started",
      severity: "warning",
      title: "Dispatch not started",
      description: `${dispatchNotStarted} paid booking${dispatchNotStarted === 1 ? "" : "s"} awaiting first offer`,
      href: "/admin/bookings?filter=dispatch_not_started",
      cta: "Review",
    });
  }

  const overdue = input.deferredDiagnostics?.overdueDispatchCount ?? 0;
  if (overdue > 0) {
    alerts.push({
      id: "dispatch-deferred",
      severity: "critical",
      title: "Deferred dispatch overdue",
      description: `${overdue} booking${overdue === 1 ? "" : "s"} past dispatch window`,
      href: "/admin/assignments",
      cta: "Diagnostics",
    });
  }

  for (const item of input.attention) {
    if (alerts.length >= limit) break;
    if (item.openOffers.length > 0) continue;
    if (seenBookingAlerts.has(item.bookingId)) continue;
    seenBookingAlerts.add(item.bookingId);
    alerts.push({
      id: `dispatch-item-${item.bookingId}`,
      severity: item.manualInterventionNeeded ? "critical" : "warning",
      title: item.queueReason || "Dispatch blocked",
      description: `${item.serviceLabel} · ${item.scheduleLabel}`,
      href: `/admin/bookings/${item.bookingId}`,
      cta: "Open",
    });
  }

  const recovery = queueCountByKey(input.queues, "recovery_needed");
  if (recovery > 0 && alerts.length < limit) {
    alerts.push({
      id: "dispatch-recovery",
      severity: "info",
      title: "Recovery candidates",
      description: `${recovery} booking${recovery === 1 ? "" : "s"} eligible for assignment recovery`,
      href: "/admin/bookings?filter=recovery_needed",
      cta: "View",
    });
  }

  return alerts.slice(0, limit);
}

export function buildAdminHomeSupportQueue(
  bookings: readonly AdminBookingListItem[],
  limit = 5,
  context?: AdminHomeDisplayContext,
): AdminHomeSupportRow[] {
  const rows: AdminHomeSupportRow[] = [];

  for (const booking of bookings) {
    const ops = booking.observation.teamSupportOps;
    const hasSupport =
      ops.coordinationStatus != null ||
      ops.teamSupportNotes != null ||
      booking.observation.isTwoCleanerRequest;

    if (!hasSupport) continue;

    let title = "Support request";
    let priority: AdminHomeSupportRow["priority"] = "medium";
    if (ops.coordinationStatus?.status === "awaiting_coordination") {
      title = "Awaiting coordination";
      priority = "high";
    } else if (booking.observation.isTwoCleanerRequest) {
      title = "Two-cleaner support";
      priority = "high";
    } else if (ops.teamSupportNotes) {
      title = "Support notes";
    } else if (ops.coordinationStatus) {
      title = booking.observation.coordinationStatusLabel ?? "Team support";
    }

    const customerLabel =
      booking.customerLabel?.trim() && !booking.customerLabel.startsWith("Customer ")
        ? booking.customerLabel
        : "Archived customer";

    rows.push({
      id: booking.id,
      customerInitials: customerInitials(customerLabel),
      title,
      detail: `${booking.serviceLabel} · ${booking.scheduleLabel}`,
      timeLabel: formatRelativeTimeLabel(booking.updatedAt, context),
      priority,
      href: `/admin/bookings/${booking.id}`,
    });
  }

  return rows.slice(0, limit);
}

export function buildAdminHomeRhythmMetricsFromCounts(
  counts: AdminOverviewRhythmCounts,
  assignmentWorkQueueTotal: number,
): AdminHomeRhythmMetric[] {
  const todayWindowEmpty =
    counts.confirmedToday === 0 &&
    counts.completedVisitsToday === 0 &&
    counts.attentionNeeded === 0;

  return [
    {
      id: "recurring",
      label: "Recurring active",
      value: String(counts.recurringActive),
      hint: "Series or recurring frequency",
    },
    {
      id: "confirmed-today",
      label: "Confirmed today",
      value: String(counts.confirmedToday),
      hint: todayWindowEmpty
        ? "No scheduled activity in today's window"
        : "Scheduled today (SAST)",
    },
    {
      id: "attention",
      label: "Attention required",
      value: String(counts.attentionNeeded),
      hint:
        assignmentWorkQueueTotal > 0
          ? `${assignmentWorkQueueTotal} in work queue`
          : "Global queue count",
    },
    {
      id: "completed",
      label: "Completed visits",
      value: String(counts.completedVisitsToday),
      hint: todayWindowEmpty
        ? "No scheduled activity in today's window"
        : "Scheduled today (SAST)",
    },
  ];
}

export function buildAdminHomeRhythmPresentation(
  counts: AdminOverviewRhythmCounts,
  assignmentWorkQueueTotal: number,
): AdminHomeRhythmPresentation {
  const metrics = buildAdminHomeRhythmMetricsFromCounts(counts, assignmentWorkQueueTotal);
  const allZero =
    counts.recurringActive === 0 &&
    counts.confirmedToday === 0 &&
    counts.attentionNeeded === 0 &&
    counts.completedVisitsToday === 0;

  return {
    metrics,
    emptyWindowHint: allZero ? "No scheduled activity in today's window" : undefined,
  };
}

/** Rhythm strip from a loaded bookings slice (tests / fallbacks). */
export function buildAdminHomeRhythmMetrics(
  input: {
    bookings: readonly AdminBookingListItem[];
    queues: readonly AdminOperationalQueueCountItem[];
    assignmentWorkQueueTotal: number;
  },
  context?: AdminHomeDisplayContext,
): AdminHomeRhythmMetric[] {
  const recurring = input.bookings.filter(
    (b) => b.observation.teamRequestFulfillment != null,
  ).length;
  const confirmedToday = input.bookings.filter(
    (b) => b.status === "confirmed" && isScheduledToday(b.scheduledStart, context),
  ).length;
  const completed = input.bookings.filter((b) => COMPLETED_STATUSES.includes(b.status)).length;
  const attention = queueCountByKey(input.queues, "assignment_attention");

  return buildAdminHomeRhythmMetricsFromCounts(
    {
      recurringActive: recurring,
      confirmedToday,
      attentionNeeded: attention,
      completedVisitsToday: completed,
    },
    input.assignmentWorkQueueTotal,
  );
}

export function buildAdminHomePayoutSummaryView(
  payoutSummary: AdminPayoutSummary | null,
): AdminHomePayoutSummaryView {
  if (!payoutSummary) {
    return {
      payoutReadyCount: 0,
      payoutReadyLabel: "—",
      pendingReviewCents: 0,
      weeklyReadyLabel: "Payout summary unavailable",
      previewHref: "/admin/payouts",
      dataAvailable: false,
    };
  }

  const payoutReadyCount = payoutSummary.queue.length;
  return {
    payoutReadyCount,
    payoutReadyLabel: String(payoutReadyCount),
    pendingReviewCents: payoutSummary.pendingCents,
    weeklyReadyLabel:
      payoutReadyCount > 0
        ? `${formatZar(payoutSummary.payoutReadyCents)} ready`
        : "Nothing awaiting release",
    previewHref: "/admin/payouts",
    dataAvailable: true,
  };
}

export function adminHomeSnapshotCardClass(emphasize?: boolean): string {
  const base =
    "flex min-h-[4.25rem] flex-col rounded-2xl border px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-[border-color,box-shadow] duration-200";
  if (emphasize) {
    return `${base} border-red-200/90 bg-red-50/60`;
  }
  return `${base} border-zinc-200/70 bg-zinc-50/40 hover:border-zinc-300/80`;
}

export function adminHomePanelClass(): string {
  return "overflow-hidden rounded-2xl border border-zinc-200/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]";
}

export function adminHomePanelHeaderClass(): string {
  return "flex items-center justify-between gap-2 border-b border-zinc-100/90 bg-zinc-50/30 px-3 py-1.5";
}

export function adminHomePanelTitleClass(): string {
  return "text-[10px] font-semibold uppercase tracking-wider text-zinc-500";
}
