import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { enqueueZohoSalesSync, findZohoSalesSyncBySource } from "./zohoSalesSyncRepository";

/**
 * Registers existing Zoho invoice payment / auth charge rows for unified diagnostics.
 * Does not create duplicate Zoho invoices.
 */
export async function registerExistingZohoSalesSyncRows(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<{ registeredInvoicePayments: number; registeredAuthCharges: number }> {
  let registeredInvoicePayments = 0;
  let registeredAuthCharges = 0;

  const { data: invoicePayments, error: invoiceError } = await client
    .from("zoho_invoice_payments")
    .select("id, invoice_number, zoho_invoice_id, zoho_payment_id, amount_cents, currency, status")
    .in("status", ["paid", "zoho_reconcile_pending"])
    .limit(100);

  if (invoiceError) throw new Error(invoiceError.message);

  for (const row of invoicePayments ?? []) {
    const existing = await findZohoSalesSyncBySource("zoho_invoice_payment", row.id, client);
    await enqueueZohoSalesSync(
      {
        sourceType: "zoho_invoice_payment",
        sourceId: row.id,
        invoiceNumber: row.invoice_number,
        zohoInvoiceId: row.zoho_invoice_id,
        zohoPaymentId: row.zoho_payment_id,
        amountCents: row.amount_cents,
        currency: row.currency,
        syncStatus: row.zoho_payment_id ? "synced" : "pending",
        syncedAt: row.zoho_payment_id ? new Date().toISOString() : null,
      },
      client,
    );

    if (!existing) registeredInvoicePayments += 1;
  }

  const { data: authCharges, error: authError } = await client
    .from("zoho_invoice_authorization_charges")
    .select("id, invoice_number, zoho_invoice_id, zoho_payment_id, amount_cents, currency, status")
    .in("status", ["paid", "zoho_reconcile_pending"])
    .limit(100);

  if (authError) throw new Error(authError.message);

  for (const row of authCharges ?? []) {
    const existing = await findZohoSalesSyncBySource("zoho_authorization_charge", row.id, client);
    await enqueueZohoSalesSync(
      {
        sourceType: "zoho_authorization_charge",
        sourceId: row.id,
        invoiceNumber: row.invoice_number,
        zohoInvoiceId: row.zoho_invoice_id,
        zohoPaymentId: row.zoho_payment_id,
        amountCents: row.amount_cents,
        currency: row.currency,
        syncStatus: row.zoho_payment_id ? "synced" : "pending",
        syncedAt: row.zoho_payment_id ? new Date().toISOString() : null,
      },
      client,
    );

    if (!existing) registeredAuthCharges += 1;
  }

  return { registeredInvoicePayments, registeredAuthCharges };
}
