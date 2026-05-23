import "server-only";

import {
  escapeCsvCell,
  formatCsvRow,
} from "@/features/dashboards/server/adminBookingsExport";
import type { FinanceReconciliationItem } from "./financeReconciliationReadModel";

export const FINANCE_RECONCILIATION_CSV_HEADERS = [
  "source",
  "reference",
  "invoice_number",
  "booking_id",
  "amount_cents",
  "currency",
  "shalean_status",
  "paystack_status",
  "zoho_status",
  "reconciliation_status",
  "issue_code",
  "created_at",
  "paid_at",
  "synced_at",
  "action_hint",
] as const;

const FORBIDDEN_CSV_SUBSTRINGS = [
  "authorization_code",
  "access_code",
  "authorization_url",
  "refresh_token",
  "metadata",
  "@",
] as const;

export function financeReconciliationItemsToCsv(items: FinanceReconciliationItem[]): string {
  const rows = items.map((item) =>
    formatCsvRow([
      item.source,
      item.reference,
      item.invoiceNumber ?? "",
      item.bookingId ?? "",
      String(item.amountCents),
      item.currency,
      item.shaleanStatus,
      item.paystackStatus ?? "",
      item.zohoStatus ?? "",
      item.reconciliationStatus,
      item.issueCode ?? "",
      item.createdAt,
      item.paidAt ?? "",
      item.syncedAt ?? "",
      item.actionHint ?? "",
    ]),
  );

  const csv = [formatCsvRow([...FINANCE_RECONCILIATION_CSV_HEADERS]), ...rows].join("\n");
  assertFinanceReconciliationCsvSafe(csv);
  return csv;
}

export function assertFinanceReconciliationCsvSafe(csv: string): void {
  const lower = csv.toLowerCase();
  for (const forbidden of FORBIDDEN_CSV_SUBSTRINGS) {
    if (lower.includes(forbidden)) {
      throw new Error(`CSV export contains forbidden pattern: ${forbidden}`);
    }
  }
}

export function buildFinanceReconciliationExportFilename(
  exportedAt: Date = new Date(),
): string {
  const ts = exportedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `finance-reconciliation-${ts}.csv`;
}

/** @internal exported for tests */
export { escapeCsvCell };
