import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isZohoMonthlyInvoiceOperationsEnabled } from "@/lib/app/zohoMonthlyInvoiceOperationsFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { listMonthlyInvoiceBatches } from "./monthlyInvoiceBatchRepository";
import { readBatchPaymentSyncMetadata } from "./monthlyInvoicePaymentSyncTypes";

export type MonthlyInvoiceOperationsAlert = {
  code: "operations_disabled" | "generated_not_sent" | "sync_failed";
  severity: "info" | "warning" | "error";
  message: string;
  batchId?: string;
  customerId?: string;
};

export type MonthlyInvoiceOperationsDiagnostics = {
  operationsEnabled: boolean;
  generatedNotSentCount: number;
  sentUnpaidCount: number;
  overdueCount: number;
  remindersSentCount: number;
  invoicesPaidThisMonth: number;
  averageSentToPaidHours: number | null;
  syncFailureCount: number;
  alerts: MonthlyInvoiceOperationsAlert[];
};

const MAX_ALERT_ROWS = 25;

function monthStartIso(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function loadMonthlyInvoiceOperationsDiagnostics(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyInvoiceOperationsDiagnostics> {
  const operationsEnabled = isZohoMonthlyInvoiceOperationsEnabled();
  const alerts: MonthlyInvoiceOperationsAlert[] = [];

  if (!operationsEnabled) {
    alerts.push({
      code: "operations_disabled",
      severity: "info",
      message: "Monthly invoice operations are disabled.",
    });
  }

  const { count: generatedNotSentCount, error: generatedError } = await client
    .from("monthly_invoice_batches")
    .select("id", { count: "exact", head: true })
    .eq("status", "generated");

  if (generatedError) throw new Error(generatedError.message);

  const { count: sentUnpaidCount, error: sentError } = await client
    .from("monthly_invoice_batches")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent");

  if (sentError) throw new Error(sentError.message);

  const { count: overdueCount, error: overdueError } = await client
    .from("monthly_invoice_batches")
    .select("id", { count: "exact", head: true })
    .eq("status", "overdue");

  if (overdueError) throw new Error(overdueError.message);

  const monthStart = monthStartIso();
  const { count: invoicesPaidThisMonth, error: paidError } = await client
    .from("monthly_invoice_batches")
    .select("id", { count: "exact", head: true })
    .eq("status", "paid")
    .gte("paid_at", monthStart);

  if (paidError) throw new Error(paidError.message);

  const { count: remindersSentCount, error: reminderError } = await client
    .from("customer_billing_account_audit")
    .select("id", { count: "exact", head: true })
    .eq("action", "monthly_invoice_reminder_sent");

  if (reminderError) throw new Error(reminderError.message);

  const { count: syncFailureCount, error: syncFailureError } = await client
    .from("customer_billing_account_audit")
    .select("id", { count: "exact", head: true })
    .eq("action", "monthly_invoice_payment_sync_failed");

  if (syncFailureError) throw new Error(syncFailureError.message);

  const { data: paidBatches, error: avgError } = await client
    .from("monthly_invoice_batches")
    .select("sent_at, paid_at")
    .eq("status", "paid")
    .not("sent_at", "is", null)
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: false })
    .limit(100);

  if (avgError) throw new Error(avgError.message);

  let averageSentToPaidHours: number | null = null;
  const durations = (paidBatches ?? [])
    .map((row) => {
      if (!row.sent_at || !row.paid_at) return null;
      const sentMs = new Date(row.sent_at).getTime();
      const paidMs = new Date(row.paid_at).getTime();
      if (!Number.isFinite(sentMs) || !Number.isFinite(paidMs) || paidMs <= sentMs) return null;
      return (paidMs - sentMs) / (1000 * 60 * 60);
    })
    .filter((value): value is number => value != null);

  if (durations.length > 0) {
    averageSentToPaidHours =
      Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) / 10;
  }

  if ((generatedNotSentCount ?? 0) > 0 && operationsEnabled) {
    const batches = await listMonthlyInvoiceBatches({ status: "generated", limit: MAX_ALERT_ROWS }, client);
    for (const batch of batches) {
      alerts.push({
        code: "generated_not_sent",
        severity: "warning",
        message: `Batch ${batch.billingMonth} generated but not sent to customer.`,
        batchId: batch.id,
        customerId: batch.customerId,
      });
    }
  }

  if ((syncFailureCount ?? 0) > 0 && operationsEnabled) {
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
    operationsEnabled,
    generatedNotSentCount: generatedNotSentCount ?? 0,
    sentUnpaidCount: sentUnpaidCount ?? 0,
    overdueCount: overdueCount ?? 0,
    remindersSentCount: remindersSentCount ?? 0,
    invoicesPaidThisMonth: invoicesPaidThisMonth ?? 0,
    averageSentToPaidHours,
    syncFailureCount: syncFailureCount ?? 0,
    alerts,
  };
}
