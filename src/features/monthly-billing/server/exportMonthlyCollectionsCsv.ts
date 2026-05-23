import "server-only";

import type { MonthlyCollectionsDashboard } from "./loadMonthlyCollectionsDashboard";

export function buildCollectionsSummaryCsv(dashboard: MonthlyCollectionsDashboard): string {
  const headers = [
    "customer_id",
    "customer_name",
    "outstanding_total_cents",
    "overdue_count",
    "reminder_count",
    "risk_score",
    "risk_level",
    "recommendation",
  ];
  const rows = [
    ...dashboard.healthy,
    ...dashboard.reminderDue,
    ...dashboard.overdue,
    ...dashboard.escalationRecommended,
    ...dashboard.disputed,
  ];
  const unique = new Map(rows.map((row) => [row.customerId, row]));
  const lines = [headers.join(",")];
  for (const row of unique.values()) {
    lines.push(
      [
        row.customerId,
        `"${(row.customerName ?? "").replace(/"/g, '""')}"`,
        row.outstandingTotalCents,
        row.overdueCount,
        row.reminderCount,
        row.riskScore,
        row.riskLevel,
        row.recommendation,
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function buildOverdueAccountsCsv(dashboard: MonthlyCollectionsDashboard): string {
  const headers = [
    "customer_id",
    "customer_name",
    "batch_id",
    "billing_month",
    "invoice_number",
    "total_cents",
    "due_date",
    "aging_bucket",
  ];
  const lines = [headers.join(",")];
  for (const customer of dashboard.overdue) {
    for (const batch of customer.batches) {
      lines.push(
        [
          customer.customerId,
          `"${(customer.customerName ?? "").replace(/"/g, '""')}"`,
          batch.batchId,
          batch.billingMonth,
          batch.invoiceNumber ?? "",
          batch.totalCents,
          batch.dueDate ?? "",
          batch.agingBucket,
        ].join(","),
      );
    }
  }
  return lines.join("\n");
}

export function buildAgingReportCsv(dashboard: MonthlyCollectionsDashboard): string {
  const lines = ["aging_bucket,count", ...Object.entries(dashboard.agingBuckets).map(([k, v]) => `${k},${v}`)];
  return lines.join("\n");
}
