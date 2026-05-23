import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { PaystackChargeFailure } from "@/features/payments/server/paystackTypes";
import {
  buildZohoInvoiceWebhookProviderEventId,
  readZohoInvoicePaymentIdFromMetadata,
} from "@/features/payments/server/detectPaystackWebhookPaymentSource";
import {
  findZohoInvoicePaymentById,
  findZohoInvoicePaymentByReference,
  insertZohoInvoicePaymentEvent,
  markZohoInvoicePaymentFailed,
} from "./zohoInvoicePaymentRepository";

export type ProcessZohoInvoiceChargeFailureResult =
  | {
      ok: true;
      handled: true;
      source: "zoho_invoice";
      invoiceNumber: string;
      status: "failed";
      idempotent: boolean;
    }
  | { ok: true; handled: false; reason: string; idempotent?: boolean }
  | { ok: false; code: string; message: string };

async function resolvePaymentRow(
  charge: PaystackChargeFailure,
  client: SupabaseClient<Database>,
) {
  const byReference = await findZohoInvoicePaymentByReference(charge.reference, client);
  if (byReference) return byReference;

  const paymentId = readZohoInvoicePaymentIdFromMetadata(charge.metadata);
  if (paymentId) {
    return findZohoInvoicePaymentById(paymentId, client);
  }

  return null;
}

export async function processZohoInvoiceChargeFailure(
  charge: PaystackChargeFailure,
  eventType = "charge.failed",
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ProcessZohoInvoiceChargeFailureResult> {
  const paymentRow = await resolvePaymentRow(charge, client);
  if (!paymentRow) {
    return { ok: true, handled: false, reason: "zoho_invoice_payment_not_found" };
  }

  const providerEventId = buildZohoInvoiceWebhookProviderEventId(
    "charge.failed",
    charge.transactionId,
  );

  let paymentEvent: "inserted" | "duplicate";
  try {
    const recorded = await insertZohoInvoicePaymentEvent(
      {
        zohoInvoicePaymentId: paymentRow.id,
        providerEventId,
        eventType,
        paystackReference: charge.reference,
        payload: {
          transactionId: charge.transactionId,
          amountCents: charge.amountCents,
          paystackStatus: charge.paystackStatus,
          source: "webhook",
        },
      },
      client,
    );
    paymentEvent = recorded.outcome;
  } catch {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Could not record zoho_invoice_payment_events row.",
    };
  }

  if (paymentEvent === "duplicate") {
    logZohoInvoicePaymentEvent("zoho_invoice_webhook_duplicate", {
      invoiceNumber: paymentRow.invoice_number,
      paystackReference: charge.reference,
      zohoInvoicePaymentId: paymentRow.id,
      providerEventId,
    });

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice",
      invoiceNumber: paymentRow.invoice_number,
      status: "failed",
      idempotent: true,
    };
  }

  if (paymentRow.status === "paid") {
    return {
      ok: true,
      handled: false,
      reason: "skipped:already_paid",
      idempotent: true,
    };
  }

  await markZohoInvoicePaymentFailed(
    {
      id: paymentRow.id,
      paystackStatus: charge.paystackStatus,
      reason: charge.gatewayResponse ?? "paystack_charge_failed",
    },
    client,
  );

  logZohoInvoicePaymentEvent("zoho_invoice_marked_failed", {
    invoiceNumber: paymentRow.invoice_number,
    paystackReference: charge.reference,
    zohoInvoicePaymentId: paymentRow.id,
  });

  return {
    ok: true,
    handled: true,
    source: "zoho_invoice",
    invoiceNumber: paymentRow.invoice_number,
    status: "failed",
    idempotent: false,
  };
}
