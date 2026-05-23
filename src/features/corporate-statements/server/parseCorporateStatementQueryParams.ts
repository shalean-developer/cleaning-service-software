import "server-only";

import type { CorporateStatementFilters } from "./corporateStatementReadModel";

export const CORPORATE_STATEMENT_DEFAULT_LIMIT = 200;
export const CORPORATE_STATEMENT_MAX_LIMIT = 500;

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

export type CorporateStatementPeriodType = "monthly" | "custom";

export function resolveCorporateStatementPeriodBounds(
  periodType: CorporateStatementPeriodType,
  from?: string,
  to?: string,
  referenceDate: Date = new Date(),
): { periodStart: string; periodEnd: string } {
  if (periodType === "custom") {
    return {
      periodStart: from?.trim() || startOfUtcMonth(referenceDate).toISOString(),
      periodEnd: to?.trim() || endOfUtcDay(referenceDate).toISOString(),
    };
  }

  const anchor = from?.trim() ? new Date(from) : referenceDate;
  const safeAnchor = Number.isNaN(anchor.getTime()) ? referenceDate : anchor;

  return {
    periodStart: startOfUtcMonth(safeAnchor).toISOString(),
    periodEnd: endOfUtcMonth(safeAnchor).toISOString(),
  };
}

export class CorporateStatementValidationError extends Error {
  readonly code = "VALIDATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "CorporateStatementValidationError";
  }
}

export function parseCorporateStatementQueryParams(
  searchParams: URLSearchParams,
  referenceDate: Date = new Date(),
): CorporateStatementFilters {
  const customerEmail = searchParams.get("customerEmail")?.trim() || undefined;
  const customerName = searchParams.get("customerName")?.trim() || undefined;
  const zohoCustomerId = searchParams.get("zohoCustomerId")?.trim() || undefined;

  if (!customerEmail && !customerName && !zohoCustomerId) {
    throw new CorporateStatementValidationError(
      "At least one customer identifier is required (customerEmail, customerName, or zohoCustomerId).",
    );
  }

  const periodTypeParam = searchParams.get("periodType")?.trim() as
    | CorporateStatementPeriodType
    | undefined;
  const periodType =
    periodTypeParam === "custom" ? ("custom" as const) : ("monthly" as const);

  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;

  const limitParam = searchParams.get("limit");
  let limit = CORPORATE_STATEMENT_DEFAULT_LIMIT;
  if (limitParam?.trim()) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, CORPORATE_STATEMENT_MAX_LIMIT);
    }
  }

  const { periodStart, periodEnd } = resolveCorporateStatementPeriodBounds(
    periodType,
    from,
    to,
    referenceDate,
  );

  return {
    customerEmail,
    customerName,
    zohoCustomerId,
    periodType,
    from: periodStart,
    to: periodEnd,
    limit,
  };
}

export function buildCorporateStatementExportHref(filters: CorporateStatementFilters): string {
  const params = new URLSearchParams();
  params.set("format", "csv");
  params.set("periodType", filters.periodType);
  if (filters.customerEmail) params.set("customerEmail", filters.customerEmail);
  if (filters.customerName) params.set("customerName", filters.customerName);
  if (filters.zohoCustomerId) params.set("zohoCustomerId", filters.zohoCustomerId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return `/api/admin/finance/corporate-statements/export?${params.toString()}`;
}

/** @internal exported for tests */
export { startOfUtcMonth, endOfUtcMonth };
