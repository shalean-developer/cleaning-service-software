import "server-only";

import type { FinanceReconciliationSource } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import {
  FINANCE_RECONCILIATION_DEFAULT_LIMIT,
  FINANCE_RECONCILIATION_MAX_LIMIT,
} from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import type { TaxReportFilters, TaxReportPeriodType } from "./taxReportReadModel";

const ALLOWED_PERIOD_TYPES = new Set<TaxReportPeriodType>(["monthly", "quarterly", "custom"]);

const ALLOWED_SOURCES = new Set<FinanceReconciliationSource | "all">([
  "all",
  "booking",
  "zoho_invoice",
  "saved_card_invoice",
  "refund_credit",
]);

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
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
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1));
}

function endOfUtcQuarter(date: Date): Date {
  const start = startOfUtcQuarter(date);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0, 23, 59, 59, 999));
}

export function resolveTaxReportPeriodBounds(
  periodType: TaxReportPeriodType,
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

function parseIncludeUnresolved(searchParams: URLSearchParams): boolean {
  const raw = searchParams.get("includeUnresolved")?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}

export function parseTaxReportQueryParams(
  searchParams: URLSearchParams,
  referenceDate: Date = new Date(),
): TaxReportFilters {
  const periodTypeParam = searchParams.get("periodType")?.trim() as TaxReportPeriodType | undefined;
  const periodType =
    periodTypeParam && ALLOWED_PERIOD_TYPES.has(periodTypeParam)
      ? periodTypeParam
      : ("monthly" as const);

  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;

  const sourceParam = searchParams.get("source")?.trim() as
    | FinanceReconciliationSource
    | "all"
    | undefined;
  const source =
    sourceParam && ALLOWED_SOURCES.has(sourceParam) ? sourceParam : ("all" as const);

  const limitParam = searchParams.get("limit");
  let limit = FINANCE_RECONCILIATION_DEFAULT_LIMIT;
  if (limitParam?.trim()) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, FINANCE_RECONCILIATION_MAX_LIMIT);
    }
  }

  const { periodStart, periodEnd } = resolveTaxReportPeriodBounds(
    periodType,
    from,
    to,
    referenceDate,
  );

  return {
    periodType,
    from: periodStart,
    to: periodEnd,
    source,
    limit,
    includeUnresolved: parseIncludeUnresolved(searchParams),
  };
}

export function buildTaxReportDetailExportHref(filters: TaxReportFilters): string {
  const params = new URLSearchParams();
  params.set("format", "csv");
  params.set("periodType", filters.periodType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  if (filters.includeUnresolved) params.set("includeUnresolved", "true");
  return `/api/admin/finance/tax-reports/export?${params.toString()}`;
}

export function buildTaxReportSummaryExportHref(filters: TaxReportFilters): string {
  const params = new URLSearchParams();
  params.set("format", "csv");
  params.set("periodType", filters.periodType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  if (filters.includeUnresolved) params.set("includeUnresolved", "true");
  return `/api/admin/finance/tax-reports/summary-export?${params.toString()}`;
}

/** @internal exported for tests */
export { startOfUtcMonth, endOfUtcMonth, startOfUtcQuarter, endOfUtcQuarter };
