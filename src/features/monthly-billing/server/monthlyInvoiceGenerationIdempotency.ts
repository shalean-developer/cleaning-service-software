import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";

export type MonthlyInvoiceGenerationIdempotencyStoredResult = {
  action: "monthly_invoice_generated";
  batchId: string;
  customerId: string;
  zohoInvoiceId: string;
  zohoInvoiceNumber: string | null;
  status: string;
  totalCents: number;
  itemCount: number;
  idempotent: boolean;
};

function parseStoredResult(raw: unknown): MonthlyInvoiceGenerationIdempotencyStoredResult | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (row.action !== "monthly_invoice_generated") return null;
  if (typeof row.batchId !== "string" || typeof row.customerId !== "string") return null;
  if (typeof row.zohoInvoiceId !== "string") return null;
  return {
    action: "monthly_invoice_generated",
    batchId: row.batchId,
    customerId: row.customerId,
    zohoInvoiceId: row.zohoInvoiceId,
    zohoInvoiceNumber: typeof row.zohoInvoiceNumber === "string" ? row.zohoInvoiceNumber : null,
    status: typeof row.status === "string" ? row.status : "generated",
    totalCents: typeof row.totalCents === "number" ? row.totalCents : 0,
    itemCount: typeof row.itemCount === "number" ? row.itemCount : 0,
    idempotent: true,
  };
}

export async function findMonthlyInvoiceGenerationIdempotency(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<MonthlyInvoiceGenerationIdempotencyStoredResult | null> {
  const { data, error } = await client
    .from("customer_billing_account_idempotency")
    .select("result")
    .eq("idempotency_key", idempotencyKey.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return parseStoredResult(data?.result);
}

export async function storeMonthlyInvoiceGenerationIdempotency(
  client: SupabaseClient<Database>,
  input: {
    idempotencyKey: string;
    customerId: string;
    adminProfileId: string;
    result: MonthlyInvoiceGenerationIdempotencyStoredResult;
  },
): Promise<void> {
  const payload = {
    action: input.result.action,
    batchId: input.result.batchId,
    customerId: input.result.customerId,
    zohoInvoiceId: input.result.zohoInvoiceId,
    zohoInvoiceNumber: input.result.zohoInvoiceNumber,
    status: input.result.status,
    totalCents: input.result.totalCents,
    itemCount: input.result.itemCount,
    idempotent: input.result.idempotent,
  } satisfies Json;

  const { error } = await client.from("customer_billing_account_idempotency").insert({
    idempotency_key: input.idempotencyKey.trim(),
    customer_id: input.customerId,
    admin_profile_id: input.adminProfileId,
    action: "monthly_invoice_generated",
    result: payload,
  });

  if (error?.code === "23505") return;
  if (error) throw new Error(error.message);
}

export function buildGenerationIdempotencyStoredResult(input: {
  batchId: string;
  customerId: string;
  zohoInvoiceId: string;
  zohoInvoiceNumber: string | null;
  totalCents: number;
  itemCount: number;
}): MonthlyInvoiceGenerationIdempotencyStoredResult {
  return {
    action: "monthly_invoice_generated",
    batchId: input.batchId,
    customerId: input.customerId,
    zohoInvoiceId: input.zohoInvoiceId,
    zohoInvoiceNumber: input.zohoInvoiceNumber,
    status: "generated",
    totalCents: input.totalCents,
    itemCount: input.itemCount,
    idempotent: false,
  };
}
