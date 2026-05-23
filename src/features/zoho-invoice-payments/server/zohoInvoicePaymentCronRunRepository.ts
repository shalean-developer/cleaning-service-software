import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, ZohoInvoicePaymentCronRunRow } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

export type StartCronRunInput = {
  jobName: string;
};

export async function startZohoInvoicePaymentCronRun(
  input: StartCronRunInput,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentCronRunRow> {
  const { data, error } = await client
    .from("zoho_invoice_payment_cron_runs")
    .insert({
      job_name: input.jobName,
      status: "started",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to start cron run record.");
  }

  return data;
}

export async function completeZohoInvoicePaymentCronRun(
  id: string,
  summary: Record<string, unknown>,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<void> {
  const { error } = await client
    .from("zoho_invoice_payment_cron_runs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      summary: summary as Json,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function failZohoInvoicePaymentCronRun(
  id: string,
  summary: Record<string, unknown>,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<void> {
  const { error } = await client
    .from("zoho_invoice_payment_cron_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      summary: summary as Json,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function getLatestZohoInvoicePaymentCronRun(
  jobName: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoicePaymentCronRunRow | null> {
  const { data, error } = await client
    .from("zoho_invoice_payment_cron_runs")
    .select("*")
    .eq("job_name", jobName)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}
