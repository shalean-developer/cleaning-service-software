import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isZohoMonthlyInvoicePaymentSyncEnabled } from "@/lib/app/zohoMonthlyInvoicePaymentSyncFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { readBatchPaymentSyncMetadata } from "./monthlyInvoicePaymentSyncTypes";
import { listMonthlyInvoiceBatches } from "./monthlyInvoiceBatchRepository";

export type MonthlyInvoicePaymentSyncAlert = {
  code: "sync_disabled" | "sync_failed" | "overdue_batch";
  severity: "info" | "warning" | "error";
  message: string;
  batchId?: string;
  customerId?: string;
};

export type MonthlyInvoicePaymentSyncDiagnostics = {
  syncEnabled: boolean;
  generatedAwaitingPayment: number;
  overdueBatchCount: number;
  paidThisMonthCount: number;
  syncFailureCount: number;
  paidViaShaleanPayPageCount: number;
  paidExternallyInZohoCount: number;
  alerts: MonthlyInvoicePaymentSyncAlert[];
};

const MAX_ALERT_ROWS = 25;

function monthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function loadMonthlyInvoicePaymentSyncDiagnostics(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyInvoicePaymentSyncDiagnostics> {
  const syncEnabled = isZohoMonthlyInvoicePaymentSyncEnabled();
  const alerts: MonthlyInvoicePaymentSyncAlert[] = [];

  if (!syncEnabled) {
    alerts.push({
      code: "sync_disabled",
      severity: "info",
      message: "Monthly invoice payment sync is disabled.",
    });
  }

  const { count: generatedAwaitingPayment, error: generatedError } = await client
    .from("monthly_invoice_batches")
    .select("id", { count: "exact", head: true })
    .in("status", ["generated", "sent"]);

  if (generatedError) throw new Error(generatedError.message);

  const { count: overdueBatchCount, error: overdueError } = await client
    .from("monthly_invoice_batches")
    .select("id", { count: "exact", head: true })
    .eq("status", "overdue");

  if (overdueError) throw new Error(overdueError.message);

  const monthStart = monthStartIso();
  const { count: paidThisMonthCount, error: paidError } = await client
    .from("monthly_invoice_batches")
    .select("id", { count: "exact", head: true })
    .eq("status", "paid")
    .gte("paid_at", monthStart);

  if (paidError) throw new Error(paidError.message);

  const { count: syncFailureCount, error: failureError } = await client
    .from("customer_billing_account_audit")
    .select("id", { count: "exact", head: true })
    .eq("action", "monthly_invoice_payment_sync_failed");

  if (failureError) throw new Error(failureError.message);

  const { count: paidViaShaleanPayPageCount, error: shaleanPaidError } = await client
    .from("customer_billing_account_audit")
    .select("id", { count: "exact", head: true })
    .eq("action", "monthly_invoice_paid")
    .filter("payload->>source", "eq", "shalean_pay_page");

  if (shaleanPaidError) throw new Error(shaleanPaidError.message);

  const { count: paidExternallyInZohoCount, error: zohoPaidError } = await client
    .from("customer_billing_account_audit")
    .select("id", { count: "exact", head: true })
    .eq("action", "monthly_invoice_paid")
    .filter("payload->>source", "eq", "zoho_books");

  if (zohoPaidError) throw new Error(zohoPaidError.message);

  if ((overdueBatchCount ?? 0) > 0 && syncEnabled) {
    const overdueBatches = await listMonthlyInvoiceBatches({ status: "overdue", limit: MAX_ALERT_ROWS }, client);
    for (const batch of overdueBatches) {
      alerts.push({
        code: "overdue_batch",
        severity: "warning",
        message: `Batch ${batch.billingMonth} is overdue.`,
        batchId: batch.id,
        customerId: batch.customerId,
      });
    }
  }

  if ((syncFailureCount ?? 0) > 0 && syncEnabled) {
    const batches = await listMonthlyInvoiceBatches({ limit: MAX_ALERT_ROWS * 2 }, client);
    for (const batch of batches) {
      const syncMeta = readBatchPaymentSyncMetadata(batch.metadata);
      if (!syncMeta.lastError) continue;
      if (alerts.filter((a) => a.code === "sync_failed").length >= MAX_ALERT_ROWS) break;
      alerts.push({
        code: "sync_failed",
        severity: "error",
        message: syncMeta.lastError,
        batchId: batch.id,
        customerId: batch.customerId,
      });
    }
  }

  return {
    syncEnabled,
    generatedAwaitingPayment: generatedAwaitingPayment ?? 0,
    overdueBatchCount: overdueBatchCount ?? 0,
    paidThisMonthCount: paidThisMonthCount ?? 0,
    syncFailureCount: syncFailureCount ?? 0,
    paidViaShaleanPayPageCount: paidViaShaleanPayPageCount ?? 0,
    paidExternallyInZohoCount: paidExternallyInZohoCount ?? 0,
    alerts,
  };
}
