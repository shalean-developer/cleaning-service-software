import "server-only";

import type {
  FinanceReconciliationFilters,
  FinanceReconciliationSource,
  FinanceReconciliationStatus,
} from "./financeReconciliationReadModel";
import {
  FINANCE_RECONCILIATION_DEFAULT_LIMIT,
  FINANCE_RECONCILIATION_MAX_LIMIT,
} from "./financeReconciliationReadModel";

const ALLOWED_SOURCES = new Set<FinanceReconciliationSource | "all">([
  "all",
  "booking",
  "zoho_invoice",
  "saved_card_invoice",
  "refund_credit",
]);

const ALLOWED_STATUSES = new Set<FinanceReconciliationStatus | "all">([
  "all",
  "matched",
  "pending",
  "mismatch",
  "failed",
]);

export function parseFinanceReconciliationQueryParams(
  searchParams: URLSearchParams,
): FinanceReconciliationFilters {
  const from = searchParams.get("from")?.trim() || undefined;
  const to = searchParams.get("to")?.trim() || undefined;
  const sourceParam = searchParams.get("source")?.trim() as
    | FinanceReconciliationSource
    | "all"
    | undefined;
  const statusParam = searchParams.get("status")?.trim() as
    | FinanceReconciliationStatus
    | "all"
    | undefined;
  const cursor = searchParams.get("cursor")?.trim() || undefined;

  const limitParam = searchParams.get("limit");
  let limit = FINANCE_RECONCILIATION_DEFAULT_LIMIT;
  if (limitParam?.trim()) {
    const parsed = Number.parseInt(limitParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, FINANCE_RECONCILIATION_MAX_LIMIT);
    }
  }

  const source =
    sourceParam && ALLOWED_SOURCES.has(sourceParam) ? sourceParam : ("all" as const);
  const status =
    statusParam && ALLOWED_STATUSES.has(statusParam) ? statusParam : ("all" as const);

  return { from, to, source, status, limit, cursor };
}

export function buildFinanceReconciliationExportHref(
  filters: FinanceReconciliationFilters,
): string {
  const params = new URLSearchParams();
  params.set("format", "csv");
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.source && filters.source !== "all") params.set("source", filters.source);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  const qs = params.toString();
  return qs
    ? `/api/admin/finance/reconciliation/export?${qs}`
    : "/api/admin/finance/reconciliation/export?format=csv";
}
