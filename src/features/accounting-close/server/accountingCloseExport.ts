import "server-only";

import { formatCsvRow } from "@/features/dashboards/server/adminBookingsExport";
import type {
  AccountingCloseLineItem,
  AccountingCloseSummary,
} from "./accountingCloseReadModel";

export const ACCOUNTING_CLOSE_DETAIL_CSV_HEADERS = [
  "period",
  "source",
  "reference",
  "invoice_number",
  "booking_id",
  "amount_cents",
  "signed_amount_cents",
  "status",
  "reconciliation_status",
  "issue_code",
  "created_at",
  "paid_at",
  "synced_at",
] as const;

export const ACCOUNTING_CLOSE_SUMMARY_CSV_HEADERS = [
  "period_start",
  "period_end",
  "gross_sales_cents",
  "refunds_credits_cents",
  "net_sales_cents",
  "matched_amount_cents",
  "pending_amount_cents",
  "mismatch_amount_cents",
  "failed_amount_cents",
  "total_transactions",
  "paid_transactions",
  "failed_transactions",
  "refund_credit_count",
  "unresolved_count",
  "ready_to_close",
  "blocking_issues",
] as const;

const FORBIDDEN_CSV_SUBSTRINGS = [
  "authorization_code",
  "access_code",
  "authorization_url",
  "refresh_token",
  "metadata",
  "@",
] as const;

function formatPeriodLabel(summary: AccountingCloseSummary): string {
  return `${summary.periodStart.slice(0, 10)} to ${summary.periodEnd.slice(0, 10)}`;
}

export function accountingCloseItemsToCsv(
  items: AccountingCloseLineItem[],
  summary: AccountingCloseSummary,
): string {
  const period = formatPeriodLabel(summary);
  const rows = items.map((item) =>
    formatCsvRow([
      period,
      item.source,
      item.reference,
      item.invoiceNumber ?? "",
      item.bookingId ?? "",
      String(item.amountCents),
      String(item.signedAmountCents),
      item.status,
      item.reconciliationStatus,
      item.issueCode ?? "",
      item.createdAt,
      item.paidAt ?? "",
      item.syncedAt ?? "",
    ]),
  );

  const csv = [formatCsvRow([...ACCOUNTING_CLOSE_DETAIL_CSV_HEADERS]), ...rows].join("\n");
  assertAccountingCloseCsvSafe(csv);
  return csv;
}

export function accountingCloseSummaryToCsv(summary: AccountingCloseSummary): string {
  const csv = formatCsvRow([
    ...ACCOUNTING_CLOSE_SUMMARY_CSV_HEADERS,
  ]);

  const row = formatCsvRow([
    summary.periodStart,
    summary.periodEnd,
    String(summary.grossSalesCents),
    String(summary.refundsCreditsCents),
    String(summary.netSalesCents),
    String(summary.matchedAmountCents),
    String(summary.pendingAmountCents),
    String(summary.mismatchAmountCents),
    String(summary.failedAmountCents),
    String(summary.totalTransactions),
    String(summary.paidTransactions),
    String(summary.failedTransactions),
    String(summary.refundCreditCount),
    String(summary.unresolvedCount),
    summary.readyToClose ? "true" : "false",
    summary.blockingIssues.join("; "),
  ]);

  const content = [csv, row].join("\n");
  assertAccountingCloseCsvSafe(content);
  return content;
}

export function assertAccountingCloseCsvSafe(csv: string): void {
  const lower = csv.toLowerCase();
  for (const forbidden of FORBIDDEN_CSV_SUBSTRINGS) {
    if (lower.includes(forbidden)) {
      throw new Error(`CSV export contains forbidden pattern: ${forbidden}`);
    }
  }
}

export function buildAccountingCloseDetailExportFilename(
  exportedAt: Date = new Date(),
): string {
  const ts = exportedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `accounting-close-detail-${ts}.csv`;
}

export function buildAccountingCloseSummaryExportFilename(
  exportedAt: Date = new Date(),
): string {
  const ts = exportedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `accounting-close-summary-${ts}.csv`;
}
