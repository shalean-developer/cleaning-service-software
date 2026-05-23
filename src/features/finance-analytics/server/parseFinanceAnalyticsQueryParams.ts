import "server-only";

import type {
  FinanceAnalyticsFilters,
  FinanceAnalyticsPeriodType,
  RevenueTrendGranularity,
} from "./financeAnalyticsTypes";

const ALLOWED_PERIOD_TYPES = new Set<FinanceAnalyticsPeriodType>([
  "weekly",
  "monthly",
  "quarterly",
  "custom",
]);

const ALLOWED_TREND_GRANULARITIES = new Set<RevenueTrendGranularity>([
  "daily",
  "weekly",
  "monthly",
]);

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

function startOfUtcWeek(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() + diff);
  return startOfUtcDay(start);
}

function endOfUtcWeek(date: Date): Date {
  const start = startOfUtcWeek(date);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return endOfUtcDay(end);
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfUtcMonth(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
}

function startOfUtcQuarter(date: Date): Date {
  const quarter = Math.floor(date.getUTCMonth() / 3);
  return new Date(Date.UTC(date.getUTCFullYear(), quarter * 3, 1));
}

function endOfUtcQuarter(date: Date): Date {
  const quarter = Math.floor(date.getUTCMonth() / 3);
  const endMonth = quarter * 3 + 2;
  return new Date(
    Date.UTC(date.getUTCFullYear(), endMonth + 1, 0, 23, 59, 59, 999),
  );
}

export function resolveFinanceAnalyticsPeriodBounds(
  periodType: FinanceAnalyticsPeriodType,
  from?: string,
  to?: string,
  referenceDate: Date = new Date(),
): { periodStart: string; periodEnd: string } {
  if (periodType === "custom") {
    const periodStart = from?.trim() || startOfUtcMonth(referenceDate).toISOString();
    const periodEnd = to?.trim() || endOfUtcDay(referenceDate).toISOString();
    return { periodStart, periodEnd };
  }

  const anchor = from?.trim() ? new Date(from) : referenceDate;
  const safeAnchor = Number.isNaN(anchor.getTime()) ? referenceDate : anchor;

  if (periodType === "weekly") {
    return {
      periodStart: startOfUtcWeek(safeAnchor).toISOString(),
      periodEnd: endOfUtcWeek(safeAnchor).toISOString(),
    };
  }

  if (periodType === "quarterly") {
    return {
      periodStart: startOfUtcQuarter(safeAnchor).toISOString(),
      periodEnd: endOfUtcQuarter(safeAnchor).toISOString(),
    };
  }

  return {
    periodStart: startOfUtcMonth(safeAnchor).toISOString(),
    periodEnd: endOfUtcMonth(safeAnchor).toISOString(),
  };
}

function defaultTrendGranularity(periodType: FinanceAnalyticsPeriodType): RevenueTrendGranularity {
  switch (periodType) {
    case "weekly":
      return "daily";
    case "monthly":
      return "weekly";
    case "quarterly":
      return "monthly";
    case "custom":
      return "weekly";
  }
}

export function parseFinanceAnalyticsQueryParams(
  searchParams: URLSearchParams,
  referenceDate: Date = new Date(),
): FinanceAnalyticsFilters {
  const periodTypeParam = searchParams.get("periodType")?.trim() as
    | FinanceAnalyticsPeriodType
    | undefined;
  const periodType =
    periodTypeParam && ALLOWED_PERIOD_TYPES.has(periodTypeParam)
      ? periodTypeParam
      : ("monthly" as const);

  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;

  const trendParam = searchParams.get("trendGranularity")?.trim() as
    | RevenueTrendGranularity
    | undefined;
  const trendGranularity =
    trendParam && ALLOWED_TREND_GRANULARITIES.has(trendParam)
      ? trendParam
      : defaultTrendGranularity(periodType);

  const { periodStart, periodEnd } = resolveFinanceAnalyticsPeriodBounds(
    periodType,
    from,
    to,
    referenceDate,
  );

  return {
    periodType,
    from: periodStart,
    to: periodEnd,
    trendGranularity,
  };
}

export function buildFinanceAnalyticsExportHref(
  filters: FinanceAnalyticsFilters,
  section: "summary" | "revenue-trends" | "profitability" | "operational" = "summary",
): string {
  const params = new URLSearchParams();
  params.set("format", "csv");
  params.set("periodType", filters.periodType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.trendGranularity) params.set("trendGranularity", filters.trendGranularity);
  if (section !== "summary") params.set("section", section);
  return `/api/admin/finance/analytics/export?${params.toString()}`;
}

/** @internal exported for tests */
export {
  startOfUtcWeek,
  endOfUtcWeek,
  startOfUtcMonth,
  endOfUtcMonth,
  startOfUtcQuarter,
  endOfUtcQuarter,
};
