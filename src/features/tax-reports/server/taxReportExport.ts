import "server-only";

import { formatCsvRow } from "@/features/dashboards/server/adminBookingsExport";
import type { TaxReportLineItem, TaxReportSummary } from "./taxReportReadModel";

export const TAX_REPORT_DETAIL_CSV_HEADERS = [
  "period",
  "source",
  "reference",
  "invoice_number",
  "booking_id",
  "gross_amount_cents",
  "signed_amount_cents",
  "estimated_vat_cents",
  "net_excluding_vat_cents",
  "currency",
  "paid_at",
  "created_at",
] as const;

export const TAX_REPORT_SUMMARY_CSV_HEADERS = [
  "period_start",
  "period_end",
  "vat_registered",
  "vat_rate",
  "gross_sales_cents",
  "refunds_credits_cents",
  "net_sales_after_credits_cents",
  "estimated_output_vat_cents",
  "net_excluding_vat_cents",
  "transaction_count",
  "refund_credit_count",
] as const;

const FORBIDDEN_CSV_SUBSTRINGS = [
  "authorization_code",
  "access_code",
  "authorization_url",
  "refresh_token",
  "metadata",
  "@",
] as const;

function formatPeriodLabel(summary: TaxReportSummary): string {
  return `${summary.periodStart.slice(0, 10)} to ${summary.periodEnd.slice(0, 10)}`;
}

export function taxReportItemsToCsv(
  items: TaxReportLineItem[],
  summary: TaxReportSummary,
): string {
  const period = formatPeriodLabel(summary);

  const rows = items.map((item) =>
    formatCsvRow([
      period,
      item.source,
      item.reference,
      item.invoiceNumber ?? "",
      item.bookingId ?? "",
      String(item.grossAmountCents),
      String(item.signedAmountCents),
      summary.vatRegistered ? String(item.estimatedVatCents) : "0",
      summary.vatRegistered
        ? String(item.netExcludingVatCents)
        : String(item.signedAmountCents),
      item.currency,
      item.paidAt ?? "",
      item.createdAt,
    ]),
  );

  const csv = [formatCsvRow([...TAX_REPORT_DETAIL_CSV_HEADERS]), ...rows].join("\n");
  assertTaxReportCsvSafe(csv);
  return csv;
}

export function taxReportSummaryToCsv(summary: TaxReportSummary): string {
  const header = formatCsvRow([...TAX_REPORT_SUMMARY_CSV_HEADERS]);
  const row = formatCsvRow([
    summary.periodStart,
    summary.periodEnd,
    summary.vatRegistered ? "true" : "false",
    summary.vatRegistered ? String(summary.vatRate) : "not_applicable",
    String(summary.grossSalesCents),
    String(summary.refundsCreditsCents),
    String(summary.netSalesAfterCreditsCents),
    summary.vatRegistered ? String(summary.estimatedOutputVatCents) : "0",
    summary.vatRegistered
      ? String(summary.netExcludingVatCents)
      : String(summary.netSalesAfterCreditsCents),
    String(summary.transactionCount),
    String(summary.refundCreditCount),
  ]);

  const content = [header, row].join("\n");
  assertTaxReportCsvSafe(content);
  return content;
}

export function assertTaxReportCsvSafe(csv: string): void {
  const lower = csv.toLowerCase();
  for (const forbidden of FORBIDDEN_CSV_SUBSTRINGS) {
    if (lower.includes(forbidden)) {
      throw new Error(`CSV export contains forbidden pattern: ${forbidden}`);
    }
  }
}

export function buildTaxReportDetailExportFilename(exportedAt: Date = new Date()): string {
  const ts = exportedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `tax-report-detail-${ts}.csv`;
}

export function buildTaxReportSummaryExportFilename(exportedAt: Date = new Date()): string {
  const ts = exportedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `tax-report-summary-${ts}.csv`;
}
