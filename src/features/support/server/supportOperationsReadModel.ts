import "server-only";

import type { AdminSupportInboxItem, AdminSupportInboxSource } from "./adminSupportInboxReadModel";
import { buildSupportAnalyticsSnapshot, type SupportAnalyticsSnapshot } from "./supportAnalytics";
import {
  buildSupportEscalationContext,
  detectSupportEscalations,
  type SupportEscalationContext,
} from "./supportEscalation";

const MS_24H = 24 * 60 * 60 * 1000;
const MS_48H = 48 * 60 * 60 * 1000;
const MS_7D = 7 * 24 * 60 * 60 * 1000;
const WIZARD_TIMEZONE = "Africa/Johannesburg";

export type SupportOperationsBreakdown = {
  booking_support: {
    open: number;
    urgent: number;
    breached: number;
    createdToday: number;
    createdThisWeek: number;
    resolvedToday: number;
    resolvedThisWeek: number;
  };
  recurring_support: {
    open: number;
    urgent: number;
    breached: number;
    createdToday: number;
    createdThisWeek: number;
    resolvedToday: number;
    resolvedThisWeek: number;
  };
};

export type SupportOperationsSnapshot = {
  open: number;
  urgentOpen: number;
  acknowledgedAging: number;
  slaBreached: number;
  escalationCount: number;
  avgAcknowledgeMinutes: number | null;
  avgResolveMinutes: number | null;
  createdToday: number;
  createdThisWeek: number;
  resolvedToday: number;
  resolvedThisWeek: number;
  staleOpen24h: number;
  staleAcknowledged48h: number;
  oldestUnresolvedId: string | null;
  oldestUnresolvedAgeMinutes: number | null;
  breakdown: SupportOperationsBreakdown;
  analytics: SupportAnalyticsSnapshot;
  escalationContext: SupportEscalationContext;
};

function johannesburgTodayKey(reference = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIZARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(reference);
}

function isSameWeek(iso: string, reference = new Date()): boolean {
  const t = new Date(iso).getTime();
  return reference.getTime() - t <= MS_7D;
}

function isToday(iso: string): boolean {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIZARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return day === johannesburgTodayKey();
}

function isOpenStatus(status: string): boolean {
  return status === "open" || status === "acknowledged";
}

function emptyBreakdown(): SupportOperationsBreakdown["booking_support"] {
  return {
    open: 0,
    urgent: 0,
    breached: 0,
    createdToday: 0,
    createdThisWeek: 0,
    resolvedToday: 0,
    resolvedThisWeek: 0,
  };
}

export function buildSupportOperationsSnapshot(
  items: AdminSupportInboxItem[],
): SupportOperationsSnapshot {
  const breakdown: SupportOperationsBreakdown = {
    booking_support: emptyBreakdown(),
    recurring_support: emptyBreakdown(),
  };

  let open = 0;
  let urgentOpen = 0;
  let acknowledgedAging = 0;
  let slaBreached = 0;
  let createdToday = 0;
  let createdThisWeek = 0;
  let resolvedToday = 0;
  let resolvedThisWeek = 0;
  let staleOpen24h = 0;
  let staleAcknowledged48h = 0;

  const ackMinutes: number[] = [];
  const resolveMinutes: number[] = [];

  let oldestUnresolvedId: string | null = null;
  let oldestUnresolvedAgeMinutes: number | null = null;

  for (const item of items) {
    const bucket = breakdown[item.source];

    if (isToday(item.createdAt)) {
      createdToday += 1;
      bucket.createdToday += 1;
    }
    if (isSameWeek(item.createdAt)) {
      createdThisWeek += 1;
      bucket.createdThisWeek += 1;
    }

    if (item.status === "resolved" || item.status === "rejected") {
      if (item.resolvedAt && isToday(item.resolvedAt)) {
        resolvedToday += 1;
        bucket.resolvedToday += 1;
      }
      if (item.resolvedAt && isSameWeek(item.resolvedAt)) {
        resolvedThisWeek += 1;
        bucket.resolvedThisWeek += 1;
      }
      if (item.timeToResolutionMinutes != null) {
        resolveMinutes.push(item.timeToResolutionMinutes);
      }
    }

    if (item.status === "open") open += 1;
    if (item.status === "acknowledged") {
      acknowledgedAging += 1;
      if (item.ageMinutes >= 48 * 60) acknowledgedAging += 0; // counted in aging metric via item
    }

    if (isOpenStatus(item.status)) {
      bucket.open += 1;
      if (item.priority === "urgent") {
        urgentOpen += 1;
        bucket.urgent += 1;
      }
      if (item.slaStatus === "breached") {
        slaBreached += 1;
        bucket.breached += 1;
      }

      if (
        oldestUnresolvedAgeMinutes == null ||
        item.ageMinutes > oldestUnresolvedAgeMinutes
      ) {
        oldestUnresolvedAgeMinutes = item.ageMinutes;
        oldestUnresolvedId = item.id;
      }
    }

    if (item.staleOpen24h) staleOpen24h += 1;
    if (item.staleAcknowledged48h) staleAcknowledged48h += 1;

    if (item.timeToFirstResponseMinutes != null) {
      ackMinutes.push(item.timeToFirstResponseMinutes);
    }
  }

  const escalationInputs = items.map((item) => ({
    id: item.id,
    source: item.source,
    status: item.status,
    requestType: item.requestType,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    bookingId: item.bookingId,
    seriesId: item.seriesId,
    customerId: item.customerId,
    slaStatus: item.slaStatus,
    ageMinutes: item.ageMinutes,
    upcomingVisitHours: item.upcomingVisitHours,
  }));

  const escalationContext = buildSupportEscalationContext(escalationInputs);
  let escalationCount = 0;
  for (const item of escalationInputs) {
    if (detectSupportEscalations(item, escalationContext).length > 0) {
      escalationCount += 1;
    }
  }

  const analytics = buildSupportAnalyticsSnapshot(
    items.map((item) => ({
      source: item.source,
      requestType: item.requestType,
      status: item.status,
      suburb: item.suburb,
      createdAt: item.createdAt,
      resolvedAt: item.resolvedAt,
      timeToResolutionMinutes: item.timeToResolutionMinutes,
    })),
  );

  const avgAcknowledgeMinutes =
    ackMinutes.length > 0
      ? Math.round(ackMinutes.reduce((a, b) => a + b, 0) / ackMinutes.length)
      : null;
  const avgResolveMinutes =
    resolveMinutes.length > 0
      ? Math.round(resolveMinutes.reduce((a, b) => a + b, 0) / resolveMinutes.length)
      : null;

  return {
    open,
    urgentOpen,
    acknowledgedAging: items.filter(
      (i) => i.status === "acknowledged" && i.ageMinutes >= 48 * 60,
    ).length,
    slaBreached,
    escalationCount,
    avgAcknowledgeMinutes,
    avgResolveMinutes,
    createdToday,
    createdThisWeek,
    resolvedToday,
    resolvedThisWeek,
    staleOpen24h,
    staleAcknowledged48h,
    oldestUnresolvedId,
    oldestUnresolvedAgeMinutes,
    breakdown,
    analytics,
    escalationContext,
  };
}

export function filterItemsByOperationsView(
  items: AdminSupportInboxItem[],
  view: string,
): AdminSupportInboxItem[] {
  switch (view) {
    case "needs_attention":
      return items.filter(
        (i) =>
          isOpenStatus(i.status) &&
          (i.slaStatus === "breached" ||
            i.slaStatus === "warning" ||
            i.escalationReasons.length > 0 ||
            i.triageLabel === "needs_action_today"),
      );
    case "aging":
      return items.filter(
        (i) =>
          isOpenStatus(i.status) &&
          (i.staleOpen24h || i.staleAcknowledged48h || i.ageBucket === "over_48h"),
      );
    case "breached":
      return items.filter((i) => isOpenStatus(i.status) && i.slaStatus === "breached");
    case "payment_issues":
      return items.filter(
        (i) =>
          isOpenStatus(i.status) &&
          (i.requestType === "payment_help" || i.paymentRisk),
      );
    case "cleaner_service":
      return items.filter(
        (i) =>
          isOpenStatus(i.status) &&
          (i.requestType === "cleaner_issue" || i.requestType === "service_issue"),
      );
    case "recurring":
      return items.filter((i) => i.source === "recurring_support");
    case "recently_resolved":
      return items.filter(
        (i) =>
          (i.status === "resolved" || i.status === "rejected") &&
          i.resolvedAt != null &&
          isSameWeek(i.resolvedAt),
      );
    default:
      return items;
  }
}

export type { AdminSupportInboxSource };
