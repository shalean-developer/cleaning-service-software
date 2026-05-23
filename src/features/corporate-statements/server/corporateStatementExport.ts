import "server-only";

import { formatCsvRow } from "@/features/dashboards/server/adminBookingsExport";
import type {
  CorporateStatementLineItem,
  CorporateStatementSummary,
} from "./corporateStatementReadModel";

export const CORPORATE_STATEMENT_CSV_HEADERS = [
  "customer",
  "period_start",
  "period_end",
  "date",
  "type",
  "reference",
  "invoice_number",
  "description",
  "debit_cents",
  "credit_cents",
  "running_balance_cents",
  "status",
] as const;

const FORBIDDEN_CSV_SUBSTRINGS = [
  "authorization_code",
  "access_code",
  "authorization_url",
  "refresh_token",
  "metadata",
  "@",
] as const;

export function corporateStatementItemsToCsv(
  items: CorporateStatementLineItem[],
  summary: CorporateStatementSummary,
): string {
  const rows = items.map((item) =>
    formatCsvRow([
      summary.customerLabel,
      summary.periodStart,
      summary.periodEnd,
      item.date,
      item.type,
      item.reference,
      item.invoiceNumber ?? "",
      item.description,
      String(item.debitCents),
      String(item.creditCents),
      String(item.balanceCents),
      item.status,
    ]),
  );

  const csv = [formatCsvRow([...CORPORATE_STATEMENT_CSV_HEADERS]), ...rows].join("\n");
  assertCorporateStatementCsvSafe(csv);
  return csv;
}

export function assertCorporateStatementCsvSafe(csv: string): void {
  const lower = csv.toLowerCase();
  for (const forbidden of FORBIDDEN_CSV_SUBSTRINGS) {
    if (lower.includes(forbidden)) {
      throw new Error(`CSV export contains forbidden pattern: ${forbidden}`);
    }
  }
}

export function buildCorporateStatementExportFilename(exportedAt: Date = new Date()): string {
  const ts = exportedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `corporate-statement-${ts}.csv`;
}
