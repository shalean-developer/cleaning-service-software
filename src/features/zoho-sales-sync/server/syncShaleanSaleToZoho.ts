import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrCreateZohoCustomer } from "@/lib/zoho/customers";
import {
  createZohoBookingSalesInvoice,
  recordZohoBookingCustomerPayment,
} from "@/lib/zoho/sales";
import type { Database, ZohoSalesSyncSourceType } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { requireZohoSalesSyncEnabled } from "./zohoSalesSyncLaunchGuard";
import { loadShaleanSaleSource } from "./loadShaleanSaleSource";
import {
  findZohoSalesSyncBySource,
  markZohoSalesSyncFailed,
  markZohoSalesSyncSynced,
  recordZohoSalesSyncAttemptStart,
} from "./zohoSalesSyncRepository";

export type SyncShaleanSaleToZohoResult =
  | { ok: true; syncStatus: "synced" | "skipped"; syncId: string }
  | { ok: false; syncId: string; code: string; retryable: boolean };

function safeSyncError(code: string): string {
  return code.slice(0, 500);
}

export async function syncShaleanSaleToZoho(
  sourceType: ZohoSalesSyncSourceType,
  sourceId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<SyncShaleanSaleToZohoResult> {
  const gate = requireZohoSalesSyncEnabled();
  if (!gate.ok) {
    return { ok: false, syncId: sourceId, code: gate.code, retryable: false };
  }

  const syncRow = await findZohoSalesSyncBySource(sourceType, sourceId, client);
  if (!syncRow) {
    return { ok: false, syncId: sourceId, code: "SYNC_ROW_NOT_FOUND", retryable: false };
  }

  if (syncRow.sync_status === "synced") {
    return { ok: true, syncStatus: "skipped", syncId: syncRow.id };
  }

  if (syncRow.sync_status === "failed") {
    return { ok: false, syncId: syncRow.id, code: "SYNC_EXHAUSTED", retryable: false };
  }

  await recordZohoSalesSyncAttemptStart(syncRow.id, client);

  const sale = await loadShaleanSaleSource(sourceType, sourceId, client);
  if (!sale) {
    const attemptCount = syncRow.sync_attempts + 1;
    await markZohoSalesSyncFailed(syncRow.id, "SALE_SOURCE_NOT_FOUND", attemptCount, client);
    return { ok: false, syncId: syncRow.id, code: "SALE_SOURCE_NOT_FOUND", retryable: false };
  }

  try {
    if (sale.sourceType === "zoho_invoice_payment" || sale.sourceType === "zoho_authorization_charge") {
      return syncExistingZohoInvoiceSale(syncRow.id, sale, syncRow.sync_attempts, client);
    }

    return syncBookingSale(syncRow.id, sale, syncRow, client);
  } catch {
    const attemptCount = syncRow.sync_attempts + 1;
    await markZohoSalesSyncFailed(syncRow.id, "SYNC_UNEXPECTED_ERROR", attemptCount, client);
    return { ok: false, syncId: syncRow.id, code: "SYNC_UNEXPECTED_ERROR", retryable: true };
  }
}

async function syncExistingZohoInvoiceSale(
  syncId: string,
  sale: Extract<
    Awaited<ReturnType<typeof loadShaleanSaleSource>>,
    { sourceType: "zoho_invoice_payment" | "zoho_authorization_charge" }
  >,
  priorAttempts: number,
  client: SupabaseClient<Database>,
): Promise<SyncShaleanSaleToZohoResult> {
  if (sale.zohoPaymentId) {
    await markZohoSalesSyncSynced(
      syncId,
      {
        zohoInvoiceId: sale.zohoInvoiceId,
        zohoPaymentId: sale.zohoPaymentId,
        invoiceNumber: sale.invoiceNumber,
      },
      client,
    );
    return { ok: true, syncStatus: "synced", syncId };
  }

  const attemptCount = priorAttempts + 1;
  await markZohoSalesSyncFailed(
    syncId,
    "ZOHO_PAYMENT_NOT_RECORDED",
    attemptCount,
    client,
  );
  return { ok: false, syncId, code: "ZOHO_PAYMENT_NOT_RECORDED", retryable: true };
}

async function syncBookingSale(
  syncId: string,
  sale: Extract<Awaited<ReturnType<typeof loadShaleanSaleSource>>, { sourceType: "booking" }>,
  syncRow: Awaited<ReturnType<typeof findZohoSalesSyncBySource>>,
  client: SupabaseClient<Database>,
): Promise<SyncShaleanSaleToZohoResult> {
  const priorAttempts = syncRow?.sync_attempts ?? 0;

  if (syncRow?.zoho_invoice_id && syncRow.zoho_payment_id) {
    await markZohoSalesSyncSynced(
      syncId,
      {
        zohoInvoiceId: syncRow.zoho_invoice_id,
        zohoCustomerId: syncRow.zoho_customer_id,
        zohoPaymentId: syncRow.zoho_payment_id,
        invoiceNumber: syncRow.invoice_number,
      },
      client,
    );
    return { ok: true, syncStatus: "skipped", syncId };
  }

  let zohoInvoiceId = syncRow?.zoho_invoice_id ?? null;
  let invoiceNumber = syncRow?.invoice_number ?? null;
  let zohoCustomerId = syncRow?.zoho_customer_id ?? null;
  let zohoPaymentId = syncRow?.zoho_payment_id ?? null;

  if (!zohoCustomerId) {
    const customer = await findOrCreateZohoCustomer({
      email: sale.customerEmail,
      displayName: sale.customerName,
    });
    if (!customer.ok) {
      const attemptCount = priorAttempts + 1;
      await markZohoSalesSyncFailed(syncId, safeSyncError(customer.code), attemptCount, client);
      return { ok: false, syncId, code: customer.code, retryable: customer.retryable };
    }
    zohoCustomerId = customer.customerId;
  }

  if (!zohoInvoiceId) {
    const invoice = await createZohoBookingSalesInvoice({
      customerId: zohoCustomerId,
      bookingId: sale.bookingId,
      serviceName: sale.serviceName,
      bookingDate: sale.bookingDate,
      amountCents: sale.amountCents,
      currency: sale.currency,
      paystackReference: sale.paystackReference,
    });
    if (!invoice.ok) {
      const attemptCount = priorAttempts + 1;
      await markZohoSalesSyncFailed(syncId, safeSyncError(invoice.code), attemptCount, client);
      return { ok: false, syncId, code: invoice.code, retryable: invoice.retryable };
    }
    zohoInvoiceId = invoice.zohoInvoiceId;
    invoiceNumber = invoice.invoiceNumber;
    zohoCustomerId = invoice.zohoCustomerId ?? zohoCustomerId;
  }

  if (!zohoPaymentId) {
    const payment = await recordZohoBookingCustomerPayment({
      zohoInvoiceId,
      invoiceNumber,
      customerEmail: sale.customerEmail,
      amountCents: sale.amountCents,
      currency: sale.currency,
      paystackReference: sale.paystackReference,
      paymentDate: sale.paymentDate,
    });
    if (!payment.ok) {
      const attemptCount = priorAttempts + 1;
      await markZohoSalesSyncFailed(syncId, safeSyncError(payment.code), attemptCount, client);
      return { ok: false, syncId, code: payment.code, retryable: payment.retryable };
    }
    zohoPaymentId = payment.zohoPaymentId;
  }

  await markZohoSalesSyncSynced(
    syncId,
    {
      zohoInvoiceId,
      zohoCustomerId,
      zohoPaymentId,
      invoiceNumber,
    },
    client,
  );

  return { ok: true, syncStatus: "synced", syncId };
}
