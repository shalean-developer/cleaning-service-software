import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ZohoRefundCreditSyncSourceType,
} from "@/lib/database/types";
import { logZohoRefundCreditEvent } from "@/lib/zoho/zohoRefundCreditLogger";
import { findZohoSalesSyncBySource } from "./zohoSalesSyncRepository";
import { isZohoRefundCreditSyncEnabled } from "./zohoRefundCreditSyncLaunchGuard";
import { enqueueZohoRefundCreditSync } from "./zohoRefundCreditSyncRepository";
import { syncZohoRefundCreditToZoho } from "./syncZohoRefundCreditToZoho";

export type RunPostRefundZohoCreditSyncInput = {
  sourceType: ZohoRefundCreditSyncSourceType;
  sourceId: string;
  bookingId?: string | null;
  invoiceNumber?: string | null;
  zohoInvoiceId?: string | null;
  paystackReference?: string | null;
  amountCents: number;
  currency?: string;
  reason: string;
  initiatedByAdminId?: string | null;
};

/**
 * Best-effort post-refund/cancellation hook: enqueue credit sync and attempt once.
 * Booking/refund operations must never depend on Zoho.
 */
export async function runPostRefundZohoCreditSync(
  client: SupabaseClient<Database>,
  input: RunPostRefundZohoCreditSyncInput,
): Promise<void> {
  if (!isZohoRefundCreditSyncEnabled()) {
    return;
  }

  const hasZohoContext = await hasZohoAccountingContext(client, input);
  if (!hasZohoContext) {
    return;
  }

  try {
    const syncRow = await enqueueZohoRefundCreditSync(
      {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        bookingId: input.bookingId ?? null,
        invoiceNumber: input.invoiceNumber ?? null,
        zohoInvoiceId: input.zohoInvoiceId ?? null,
        paystackReference: input.paystackReference ?? null,
        amountCents: input.amountCents,
        currency: input.currency ?? "ZAR",
        reason: input.reason,
        initiatedByAdminId: input.initiatedByAdminId ?? null,
      },
      client,
    );

    logZohoRefundCreditEvent("zoho_refund_credit_sync_enqueued", {
      syncId: syncRow.id,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      amountCents: input.amountCents,
    });

    await syncZohoRefundCreditToZoho(input.sourceType, syncRow.source_id, client);
  } catch {
    // Failures remain in zoho_refund_credit_sync for cron retry.
  }
}

async function hasZohoAccountingContext(
  client: SupabaseClient<Database>,
  input: RunPostRefundZohoCreditSyncInput,
): Promise<boolean> {
  if (input.zohoInvoiceId) {
    return true;
  }

  if (input.bookingId) {
    const salesSync = await findZohoSalesSyncBySource("booking", input.bookingId, client);
    if (salesSync?.zoho_invoice_id) {
      return true;
    }
  }

  if (
    input.sourceType === "booking_refund" ||
    input.sourceType === "booking_cancellation"
  ) {
    const salesSync = await findZohoSalesSyncBySource("booking", input.sourceId, client);
    if (salesSync?.zoho_invoice_id) {
      return true;
    }
  }

  if (input.sourceType === "zoho_invoice_refund") {
    const salesSync = await findZohoSalesSyncBySource(
      "zoho_invoice_payment",
      input.sourceId,
      client,
    );
    return Boolean(salesSync?.zoho_invoice_id ?? input.zohoInvoiceId);
  }

  if (input.sourceType === "zoho_authorization_charge_refund") {
    const salesSync = await findZohoSalesSyncBySource(
      "zoho_authorization_charge",
      input.sourceId,
      client,
    );
    return Boolean(salesSync?.zoho_invoice_id ?? input.zohoInvoiceId);
  }

  return false;
}

export type RunPostBookingCancellationZohoCreditSyncInput = {
  bookingId: string;
  reason?: string;
};

/**
 * Enqueues a full credit sync when a paid booking is cancelled.
 */
export async function runPostBookingCancellationZohoCreditSync(
  client: SupabaseClient<Database>,
  input: RunPostBookingCancellationZohoCreditSyncInput,
): Promise<void> {
  const { data: payment, error } = await client
    .from("payments")
    .select("amount_cents, currency, provider_ref, status")
    .eq("booking_id", input.bookingId)
    .eq("status", "paid")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !payment) {
    return;
  }

  const salesSync = await findZohoSalesSyncBySource("booking", input.bookingId, client);

  await runPostRefundZohoCreditSync(client, {
    sourceType: "booking_cancellation",
    sourceId: input.bookingId,
    bookingId: input.bookingId,
    invoiceNumber: salesSync?.invoice_number ?? null,
    zohoInvoiceId: salesSync?.zoho_invoice_id ?? null,
    paystackReference: payment.provider_ref,
    amountCents: payment.amount_cents,
    currency: payment.currency,
    reason: input.reason?.trim() || "Booking cancelled — accounting credit adjustment",
  });
}
