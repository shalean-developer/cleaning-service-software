import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createZohoCustomerPaymentForInvoice } from "@/lib/zoho/customerPayments";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { mapPaystackVerifyData } from "@/features/payments/server/mapPaystackCharge";
import { paystackVerifyTransaction, PaystackApiError } from "@/features/payments/server/paystackClient";
import type { PaystackChargeSuccess } from "@/features/payments/server/paystackTypes";
import {
  buildZohoInvoiceWebhookProviderEventId,
  readZohoInvoicePaymentIdFromMetadata,
} from "@/features/payments/server/detectPaystackWebhookPaymentSource";
import {
  findZohoInvoicePaymentById,
  findZohoInvoicePaymentByReference,
  insertZohoInvoicePaymentEvent,
  markZohoInvoicePaymentPaid,
  markZohoInvoicePaymentReconcileFailed,
  markZohoInvoicePaymentReconcilePending,
} from "./zohoInvoicePaymentRepository";
import { captureReusableAuthorization } from "./captureReusableAuthorization";

async function triggerMonthlyBatchPaymentSyncAfterPaid(input: {
  invoiceNumber: string;
  zohoInvoiceId: string;
}): Promise<void> {
  const { runPostZohoInvoicePaymentMonthlyBatchSync } = await import(
    "@/features/monthly-billing/server/runPostZohoInvoicePaymentMonthlyBatchSync"
  );
  await runPostZohoInvoicePaymentMonthlyBatchSync(input).catch(() => undefined);
}

export type ProcessZohoInvoiceChargeSuccessResult =
  | {
      ok: true;
      handled: true;
      source: "zoho_invoice";
      invoiceNumber: string;
      status: "paid" | "zoho_reconcile_pending" | "zoho_reconcile_failed";
      idempotent: boolean;
    }
  | { ok: true; handled: false; reason: string; idempotent?: boolean }
  | { ok: false; code: string; message: string };

function normalizeCurrency(value: string | undefined | null): string {
  return (value?.trim() || "ZAR").toUpperCase();
}

async function resolvePaymentRow(
  charge: PaystackChargeSuccess,
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

export async function processZohoInvoiceChargeSuccess(
  charge: PaystackChargeSuccess,
  eventType = "charge.success",
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ProcessZohoInvoiceChargeSuccessResult> {
  const paymentRow = await resolvePaymentRow(charge, client);
  if (!paymentRow) {
    logZohoInvoicePaymentEvent("zoho_invoice_webhook_routed", {
      paystackReference: charge.reference,
      failureCode: "PAYMENT_ROW_NOT_FOUND",
    });
    return { ok: true, handled: false, reason: "zoho_invoice_payment_not_found" };
  }

  const providerEventId = buildZohoInvoiceWebhookProviderEventId(
    "charge.success",
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

    if (paymentRow.status === "paid" && paymentRow.zoho_payment_id) {
      return {
        ok: true,
        handled: true,
        source: "zoho_invoice",
        invoiceNumber: paymentRow.invoice_number,
        status: "paid",
        idempotent: true,
      };
    }
  }

  if (paymentRow.status === "paid" && paymentRow.zoho_payment_id) {
    return {
      ok: true,
      handled: true,
      source: "zoho_invoice",
      invoiceNumber: paymentRow.invoice_number,
      status: "paid",
      idempotent: true,
    };
  }

  logZohoInvoicePaymentEvent("zoho_invoice_paystack_verify_started", {
    invoiceNumber: paymentRow.invoice_number,
    paystackReference: charge.reference,
    zohoInvoicePaymentId: paymentRow.id,
  });

  let verifiedCharge: PaystackChargeSuccess | null = null;
  let verifiedCurrency = normalizeCurrency(paymentRow.currency);
  let verifiedPaystackData: Awaited<
    ReturnType<typeof paystackVerifyTransaction>
  >["data"] | null = null;

  try {
    const verifyResponse = await paystackVerifyTransaction(charge.reference);
    verifiedPaystackData = verifyResponse.data;
    verifiedCurrency = normalizeCurrency(verifyResponse.data.currency);
    verifiedCharge = mapPaystackVerifyData(verifyResponse.data);
  } catch (error) {
    const reason =
      error instanceof PaystackApiError
        ? `paystack_verify_api_${error.statusCode}`
        : "paystack_verify_failed";

    logZohoInvoicePaymentEvent("zoho_invoice_paystack_verify_failed", {
      invoiceNumber: paymentRow.invoice_number,
      paystackReference: charge.reference,
      zohoInvoicePaymentId: paymentRow.id,
      failureCode: reason,
      retryable: true,
    });

    await markZohoInvoicePaymentReconcilePending(
      {
        id: paymentRow.id,
        paystackStatus: "verify_failed",
        reason,
      },
      client,
    );

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice",
      invoiceNumber: paymentRow.invoice_number,
      status: "zoho_reconcile_pending",
      idempotent: paymentEvent === "duplicate",
    };
  }

  if (!verifiedCharge) {
    logZohoInvoicePaymentEvent("zoho_invoice_paystack_verify_failed", {
      invoiceNumber: paymentRow.invoice_number,
      paystackReference: charge.reference,
      zohoInvoicePaymentId: paymentRow.id,
      failureCode: "PAYSTACK_STATUS_NOT_SUCCESS",
      retryable: false,
    });

    await markZohoInvoicePaymentReconcileFailed(
      {
        id: paymentRow.id,
        paystackStatus: "verify_not_success",
        reason: "paystack_status_not_success",
      },
      client,
    );

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice",
      invoiceNumber: paymentRow.invoice_number,
      status: "zoho_reconcile_failed",
      idempotent: paymentEvent === "duplicate",
    };
  }

  logZohoInvoicePaymentEvent("zoho_invoice_paystack_verify_succeeded", {
    invoiceNumber: paymentRow.invoice_number,
    paystackReference: charge.reference,
    zohoInvoicePaymentId: paymentRow.id,
    amountCents: verifiedCharge.amountCents,
    currency: verifiedCurrency,
  });

  if (verifiedPaystackData) {
    try {
      await captureReusableAuthorization(paymentRow, verifiedPaystackData, client);
    } catch {
      logZohoInvoicePaymentEvent("zoho_invoice_authorization_capture_failed", {
        invoiceNumber: paymentRow.invoice_number,
        zohoInvoicePaymentId: paymentRow.id,
        failureCode: "UNHANDLED_CAPTURE_ERROR",
      });
    }
  }

  if (verifiedCharge.amountCents !== paymentRow.amount_cents) {
    logZohoInvoicePaymentEvent("zoho_invoice_amount_mismatch", {
      invoiceNumber: paymentRow.invoice_number,
      paystackReference: charge.reference,
      zohoInvoicePaymentId: paymentRow.id,
      expectedAmountCents: paymentRow.amount_cents,
      actualAmountCents: verifiedCharge.amountCents,
    });

    await markZohoInvoicePaymentReconcileFailed(
      {
        id: paymentRow.id,
        paystackStatus: "success",
        reason: "amount_mismatch",
        reconciliationMetadata: {
          expected_amount_cents: paymentRow.amount_cents,
          verified_amount_cents: verifiedCharge.amountCents,
        },
      },
      client,
    );

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice",
      invoiceNumber: paymentRow.invoice_number,
      status: "zoho_reconcile_failed",
      idempotent: paymentEvent === "duplicate",
    };
  }

  const rowCurrency = normalizeCurrency(paymentRow.currency);
  if (verifiedCurrency !== rowCurrency) {
    logZohoInvoicePaymentEvent("zoho_invoice_currency_mismatch", {
      invoiceNumber: paymentRow.invoice_number,
      paystackReference: charge.reference,
      zohoInvoicePaymentId: paymentRow.id,
      expectedCurrency: rowCurrency,
      actualCurrency: verifiedCurrency,
    });

    await markZohoInvoicePaymentReconcileFailed(
      {
        id: paymentRow.id,
        paystackStatus: "success",
        reason: "currency_mismatch",
        reconciliationMetadata: {
          expected_currency: rowCurrency,
          verified_currency: verifiedCurrency,
        },
      },
      client,
    );

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice",
      invoiceNumber: paymentRow.invoice_number,
      status: "zoho_reconcile_failed",
      idempotent: paymentEvent === "duplicate",
    };
  }

  if (paymentRow.zoho_payment_id) {
    await markZohoInvoicePaymentPaid(
      {
        id: paymentRow.id,
        zohoPaymentId: paymentRow.zoho_payment_id,
        zohoStatus: paymentRow.zoho_status,
        paystackStatus: "success",
      },
      client,
    );

    logZohoInvoicePaymentEvent("zoho_invoice_marked_paid", {
      invoiceNumber: paymentRow.invoice_number,
      paystackReference: charge.reference,
      zohoInvoicePaymentId: paymentRow.id,
      zohoPaymentId: paymentRow.zoho_payment_id,
      idempotent: true,
    });

    await triggerMonthlyBatchPaymentSyncAfterPaid({
      invoiceNumber: paymentRow.invoice_number,
      zohoInvoiceId: paymentRow.zoho_invoice_id,
    });

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice",
      invoiceNumber: paymentRow.invoice_number,
      status: "paid",
      idempotent: true,
    };
  }

  const zohoResult = await createZohoCustomerPaymentForInvoice({
    zohoInvoiceId: paymentRow.zoho_invoice_id,
    invoiceNumber: paymentRow.invoice_number,
    customerEmail: paymentRow.customer_email,
    amountCents: paymentRow.amount_cents,
    currency: paymentRow.currency,
    paystackReference: charge.reference,
    paymentDate: new Date().toISOString(),
    notes: `Shalean Paystack payment ${charge.reference}`,
  });

  if (!zohoResult.ok) {
    await markZohoInvoicePaymentReconcilePending(
      {
        id: paymentRow.id,
        paystackStatus: "success",
        reason: zohoResult.code,
        reconciliationMetadata: {
          zoho_reconcile_retryable: zohoResult.retryable,
        },
      },
      client,
    );

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice",
      invoiceNumber: paymentRow.invoice_number,
      status: "zoho_reconcile_pending",
      idempotent: paymentEvent === "duplicate",
    };
  }

  await markZohoInvoicePaymentPaid(
    {
      id: paymentRow.id,
      zohoPaymentId: zohoResult.zohoPaymentId,
      zohoStatus: zohoResult.zohoStatus,
      paystackStatus: "success",
      reconciliationMetadata: {
        paystack_transaction_id: charge.transactionId,
      },
    },
    client,
  );

  logZohoInvoicePaymentEvent("zoho_invoice_marked_paid", {
    invoiceNumber: paymentRow.invoice_number,
    paystackReference: charge.reference,
    zohoInvoicePaymentId: paymentRow.id,
    zohoPaymentId: zohoResult.zohoPaymentId,
    idempotent: false,
  });

  await triggerMonthlyBatchPaymentSyncAfterPaid({
    invoiceNumber: paymentRow.invoice_number,
    zohoInvoiceId: paymentRow.zoho_invoice_id,
  });

  return {
    ok: true,
    handled: true,
    source: "zoho_invoice",
    invoiceNumber: paymentRow.invoice_number,
    status: "paid",
    idempotent: paymentEvent === "duplicate" && paymentRow.status === "paid",
  };
}
