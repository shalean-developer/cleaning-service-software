import "server-only";

import type { FinanceReconciliationSource } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import {
  FINANCE_RECONCILIATION_DEFAULT_LIMIT,
  FINANCE_RECONCILIATION_MAX_LIMIT,
} from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import type { AccountingCloseFilters, AccountingClosePeriodType } from "./accountingCloseReadModel";

const ALLOWED_PERIOD_TYPES = new Set<AccountingClosePeriodType>(["weekly", "monthly", "custom"]);

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

export function resolveAccountingClosePeriodBounds(
  periodType: AccountingClosePeriodType,
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

  return {
    periodStart: startOfUtcMonth(safeAnchor).toISOString(),
    periodEnd: endOfUtcMonth(safeAnchor).toISOString(),
  };
}

export function parseAccountingCloseQueryParams(
  searchParams: URLSearchParams,
  referenceDate: Date = new Date(),
): AccountingCloseFilters {
  const periodTypeParam = searchParams.get("periodType")?.trim() as
    | AccountingClosePeriodType
    | undefined;
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

  const { periodStart, periodEnd } = resolveAccountingClosePeriodBounds(
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
  };
}

export function buildAccountingCloseDetailExportHref(filters: AccountingCloseFilters): string {
  const params = new URLSearchParams();
  params.set("format", "csv");
  params.set("periodType", filters.periodType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  const qs = params.toString();
  return `/api/admin/finance/accounting-close/export?${qs}`;
}

export function buildAccountingCloseSummaryExportHref(filters: AccountingCloseFilters): string {
  const params = new URLSearchParams();
  params.set("format", "csv");
  params.set("periodType", filters.periodType);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  const qs = params.toString();
  return `/api/admin/finance/accounting-close/summary-export?${qs}`;
}

/** @internal exported for tests */
export {
  startOfUtcWeek,
  endOfUtcWeek,
  startOfUtcMonth,
  endOfUtcMonth,
};
