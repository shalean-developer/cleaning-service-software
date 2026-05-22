import type { AdminSupportInboxSource } from "./adminSupportInboxReadModel";

export type SupportAnalyticsItem = {
  source: AdminSupportInboxSource;
  requestType: string;
  status: string;
  suburb: string | null;
  createdAt: string;
  resolvedAt: string | null;
  timeToResolutionMinutes: number | null;
};

export type SupportAnalyticsSnapshot = {
  byRequestType: Record<string, number>;
  bySource: Record<AdminSupportInboxSource, number>;
  bySuburb: Record<string, number>;
  paymentHelpCount: number;
  cleanerIssueCount: number;
  cancellationRequestCount: number;
  recurringVolume: number;
  avgResolutionMinutesByType: Record<string, number | null>;
  topSuburbs: { suburb: string; count: number }[];
};

export function buildSupportAnalyticsSnapshot(
  items: SupportAnalyticsItem[],
): SupportAnalyticsSnapshot {
  const byRequestType: Record<string, number> = {};
  const bySource: Record<AdminSupportInboxSource, number> = {
    booking_support: 0,
    recurring_support: 0,
  };
  const bySuburb: Record<string, number> = {};
  const resolutionByType = new Map<string, number[]>();

  let paymentHelpCount = 0;
  let cleanerIssueCount = 0;
  let cancellationRequestCount = 0;
  let recurringVolume = 0;

  for (const item of items) {
    byRequestType[item.requestType] = (byRequestType[item.requestType] ?? 0) + 1;
    bySource[item.source] += 1;

    if (item.suburb?.trim()) {
      const key = item.suburb.trim();
      bySuburb[key] = (bySuburb[key] ?? 0) + 1;
    }

    if (item.requestType === "payment_help") paymentHelpCount += 1;
    if (item.requestType === "cleaner_issue") cleanerIssueCount += 1;
    if (item.requestType.includes("cancel")) cancellationRequestCount += 1;
    if (item.source === "recurring_support") recurringVolume += 1;

    if (item.timeToResolutionMinutes != null) {
      const list = resolutionByType.get(item.requestType) ?? [];
      list.push(item.timeToResolutionMinutes);
      resolutionByType.set(item.requestType, list);
    }
  }

  const avgResolutionMinutesByType: Record<string, number | null> = {};
  for (const [type, values] of resolutionByType) {
    avgResolutionMinutesByType[type] =
      values.length > 0
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : null;
  }

  const topSuburbs = Object.entries(bySuburb)
    .map(([suburb, count]) => ({ suburb, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    byRequestType,
    bySource,
    bySuburb,
    paymentHelpCount,
    cleanerIssueCount,
    cancellationRequestCount,
    recurringVolume,
    avgResolutionMinutesByType,
    topSuburbs,
  };
}
