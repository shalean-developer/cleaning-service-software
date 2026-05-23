import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isZohoMonthlyInvoiceGenerationEnabled } from "@/lib/app/zohoMonthlyInvoiceGenerationFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

export type MonthlyInvoiceGenerationAlert = {
  code: "generation_disabled" | "missing_zoho_customer" | "generation_failed";
  severity: "info" | "warning" | "error";
  message: string;
  batchId?: string;
  customerId?: string;
};

export type MonthlyInvoiceGenerationDiagnostics = {
  generationEnabled: boolean;
  draftBatchesReadyForGeneration: number;
  generatedUnpaidBatchCount: number;
  generationFailureCount: number;
  alerts: MonthlyInvoiceGenerationAlert[];
};

const MAX_ALERT_ROWS = 25;

export async function loadMonthlyInvoiceGenerationDiagnostics(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyInvoiceGenerationDiagnostics> {
  const generationEnabled = isZohoMonthlyInvoiceGenerationEnabled();
  const alerts: MonthlyInvoiceGenerationAlert[] = [];

  if (!generationEnabled) {
    alerts.push({
      code: "generation_disabled",
      severity: "info",
      message: "Zoho invoice generation is disabled.",
    });
  }

  const { data: draftBatches, error: draftError } = await client
    .from("monthly_invoice_batches")
    .select("id, customer_id, total_cents, status")
    .eq("status", "draft");

  if (draftError) throw new Error(draftError.message);

  let draftBatchesReadyForGeneration = 0;
  for (const batch of draftBatches ?? []) {
    if ((batch.total_cents ?? 0) <= 0) continue;
    const { count } = await client
      .from("monthly_invoice_batch_items")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch.id)
      .in("status", ["accrued", "included"]);
    if ((count ?? 0) > 0) draftBatchesReadyForGeneration += 1;

    const { data: account } = await client
      .from("customer_billing_accounts")
      .select("zoho_customer_id, is_monthly_account_enabled")
      .eq("customer_id", batch.customer_id)
      .maybeSingle();

    if (
      generationEnabled &&
      account?.is_monthly_account_enabled &&
      !account.zoho_customer_id &&
      alerts.filter((a) => a.code === "missing_zoho_customer").length < MAX_ALERT_ROWS
    ) {
      alerts.push({
        code: "missing_zoho_customer",
        severity: "warning",
        message: "Draft batch ready but customer has no Zoho customer id.",
        batchId: batch.id,
        customerId: batch.customer_id,
      });
    }
  }

  const { count: generatedUnpaidBatchCount, error: generatedError } = await client
    .from("monthly_invoice_batches")
    .select("id", { count: "exact", head: true })
    .eq("status", "generated");

  if (generatedError) throw new Error(generatedError.message);

  const { count: generationFailureCount, error: failureError } = await client
    .from("customer_billing_account_audit")
    .select("id", { count: "exact", head: true })
    .eq("action", "monthly_invoice_generation_failed");

  if (failureError) throw new Error(failureError.message);

  if ((generationFailureCount ?? 0) > 0 && generationEnabled) {
    const { data: failures } = await client
      .from("customer_billing_account_audit")
      .select("payload, customer_id")
      .eq("action", "monthly_invoice_generation_failed")
      .order("created_at", { ascending: false })
      .limit(MAX_ALERT_ROWS);

    for (const row of failures ?? []) {
      const payload =
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {};
      alerts.push({
        code: "generation_failed",
        severity: "error",
        message:
          typeof payload.message === "string"
            ? payload.message
            : "Monthly invoice generation failed.",
        batchId: typeof payload.batchId === "string" ? payload.batchId : undefined,
        customerId: row.customer_id ?? undefined,
      });
    }
  }

  return {
    generationEnabled,
    draftBatchesReadyForGeneration,
    generatedUnpaidBatchCount: generatedUnpaidBatchCount ?? 0,
    generationFailureCount: generationFailureCount ?? 0,
    alerts,
  };
}
