import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isZohoMonthlyInvoiceAccrualEnabled } from "@/lib/app/zohoMonthlyInvoiceAccrualFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getRecentMonthlyInvoiceAccrualDiagnostics } from "./monthlyInvoiceAccrualDiagnostics";

export type MonthlyInvoiceAccrualAlert = {
  code:
    | "accrual_disabled"
    | "completed_not_accrued"
    | "batch_locked"
    | "missing_amount"
    | "duplicate_prevented";
  severity: "info" | "warning" | "error";
  message: string;
  bookingId?: string;
  customerId?: string;
  batchId?: string;
  count?: number;
};

export type MonthlyInvoiceAccrualDiagnostics = {
  accrualEnabled: boolean;
  alerts: MonthlyInvoiceAccrualAlert[];
  completedNotAccruedCount: number;
  draftBatchesReadyForGeneration: number;
  totalAccruedItemCount: number;
  totalAccruedAmountCents: number;
};

const MAX_ALERT_ROWS = 25;

export async function loadMonthlyInvoiceAccrualDiagnostics(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyInvoiceAccrualDiagnostics> {
  const accrualEnabled = isZohoMonthlyInvoiceAccrualEnabled();
  const alerts: MonthlyInvoiceAccrualAlert[] = [];

  if (!accrualEnabled) {
    alerts.push({
      code: "accrual_disabled",
      severity: "info",
      message: "Monthly invoice accrual is disabled.",
    });
  }

  const { data: completedMonthly, error: completedError } = await client
    .from("bookings")
    .select("id, customer_id")
    .eq("status", "completed")
    .filter("metadata->billing->>mode", "eq", "monthly_account")
    .limit(500);

  if (completedError) throw new Error(completedError.message);

  let completedNotAccruedCount = 0;
  for (const row of completedMonthly ?? []) {
    const [{ data: auth }, { data: item }] = await Promise.all([
      client
        .from("monthly_service_authorizations")
        .select("id")
        .eq("booking_id", row.id)
        .eq("status", "authorized")
        .maybeSingle(),
      client
        .from("monthly_invoice_batch_items")
        .select("id")
        .eq("booking_id", row.id)
        .maybeSingle(),
    ]);
    if (auth && !item) {
      completedNotAccruedCount += 1;
      if (alerts.filter((a) => a.code === "completed_not_accrued").length < MAX_ALERT_ROWS) {
        alerts.push({
          code: "completed_not_accrued",
          severity: accrualEnabled ? "warning" : "info",
          message: accrualEnabled
            ? "Completed authorized monthly booking has no accrued invoice item."
            : "Completed authorized monthly booking — accrual disabled.",
          bookingId: row.id,
          customerId: row.customer_id,
        });
      }
    }
  }

  for (const diag of getRecentMonthlyInvoiceAccrualDiagnostics().slice(0, MAX_ALERT_ROWS)) {
    if (diag.reason === "batch_locked") {
      alerts.push({
        code: "batch_locked",
        severity: "error",
        message: diag.message,
        bookingId: diag.bookingId,
        customerId: diag.customerId ?? undefined,
        batchId: diag.batchId ?? undefined,
      });
    } else if (diag.reason === "missing_amount") {
      alerts.push({
        code: "missing_amount",
        severity: "warning",
        message: diag.message,
        bookingId: diag.bookingId,
        customerId: diag.customerId ?? undefined,
      });
    }
  }

  const { count: totalAccruedItemCount, error: itemCountError } = await client
    .from("monthly_invoice_batch_items")
    .select("id", { count: "exact", head: true })
    .eq("status", "accrued");

  if (itemCountError) throw new Error(itemCountError.message);

  const { data: draftBatches, error: draftBatchError } = await client
    .from("monthly_invoice_batches")
    .select("id, total_cents, status")
    .eq("status", "draft");

  if (draftBatchError) throw new Error(draftBatchError.message);

  let draftBatchesReadyForGeneration = 0;
  let totalAccruedAmountCents = 0;
  for (const batch of draftBatches ?? []) {
    totalAccruedAmountCents += batch.total_cents ?? 0;
    const { count } = await client
      .from("monthly_invoice_batch_items")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch.id);
    if ((count ?? 0) > 0) draftBatchesReadyForGeneration += 1;
  }

  return {
    accrualEnabled,
    alerts,
    completedNotAccruedCount,
    draftBatchesReadyForGeneration,
    totalAccruedItemCount: totalAccruedItemCount ?? 0,
    totalAccruedAmountCents,
  };
}

export async function loadBookingInvoiceAccrualStatus(
  bookingId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<{
  accrued: boolean;
  batchId: string | null;
  billingMonth: string | null;
  amountCents: number | null;
  itemStatus: string | null;
  batchStatus?: string | null;
  zohoInvoiceId?: string | null;
  zohoInvoiceNumber?: string | null;
} | null> {
  const { data: item, error } = await client
    .from("monthly_invoice_batch_items")
    .select("batch_id, amount_cents, status, visit_date")
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!item) {
    return {
      accrued: false,
      batchId: null,
      billingMonth: null,
      amountCents: null,
      itemStatus: null,
      batchStatus: null,
      zohoInvoiceId: null,
      zohoInvoiceNumber: null,
    };
  }

  const { data: batch } = await client
    .from("monthly_invoice_batches")
    .select("billing_month, status, zoho_invoice_id, zoho_invoice_number")
    .eq("id", item.batch_id)
    .maybeSingle();

  return {
    accrued: true,
    batchId: item.batch_id,
    billingMonth: batch?.billing_month ?? null,
    amountCents: item.amount_cents,
    itemStatus: item.status,
    batchStatus: batch?.status ?? null,
    zohoInvoiceId: batch?.zoho_invoice_id ?? null,
    zohoInvoiceNumber: batch?.zoho_invoice_number ?? null,
  };
}
