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
  buildZohoInvoiceAuthorizationChargeWebhookProviderEventId,
  readAuthorizationChargeIdFromMetadata,
} from "@/features/payments/server/detectPaystackWebhookPaymentSource";
import {
  findAuthorizationChargeById,
  findAuthorizationChargeByReference,
  insertAuthorizationChargeEvent,
  markAuthorizationChargeFailed,
  markAuthorizationChargePaid,
  markAuthorizationChargeReconcilePending,
} from "./zohoInvoiceAuthorizationChargeRepository";
import { markPaymentMethodLastUsed } from "./zohoInvoicePaymentMethodRepository";

export type ProcessZohoInvoiceAuthorizationChargeSuccessResult =
  | {
      ok: true;
      handled: true;
      source: "zoho_invoice_authorization_charge";
      invoiceNumber: string;
      status: "paid" | "zoho_reconcile_pending" | "zoho_reconcile_failed";
      idempotent: boolean;
    }
  | { ok: true; handled: false; reason: string; idempotent?: boolean }
  | { ok: false; code: string; message: string };

function normalizeCurrency(value: string | undefined | null): string {
  return (value?.trim() || "ZAR").toUpperCase();
}

async function resolveChargeRow(
  charge: PaystackChargeSuccess,
  client: SupabaseClient<Database>,
) {
  const byReference = await findAuthorizationChargeByReference(charge.reference, client);
  if (byReference) return byReference;

  const chargeId = readAuthorizationChargeIdFromMetadata(charge.metadata);
  if (chargeId) {
    return findAuthorizationChargeById(chargeId, client);
  }

  return null;
}

export async function processZohoInvoiceAuthorizationChargeSuccess(
  charge: PaystackChargeSuccess,
  eventType = "charge.success",
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ProcessZohoInvoiceAuthorizationChargeSuccessResult> {
  const chargeRow = await resolveChargeRow(charge, client);
  if (!chargeRow) {
    logZohoInvoicePaymentEvent("zoho_invoice_authorization_charge_webhook_routed", {
      paystackReference: charge.reference,
      failureCode: "CHARGE_ROW_NOT_FOUND",
    });
    return { ok: true, handled: false, reason: "authorization_charge_not_found" };
  }

  const providerEventId = buildZohoInvoiceAuthorizationChargeWebhookProviderEventId(
    "charge.success",
    charge.transactionId,
  );

  let chargeEvent: "inserted" | "duplicate";
  try {
    const recorded = await insertAuthorizationChargeEvent(
      {
        authorizationChargeId: chargeRow.id,
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
    chargeEvent = recorded.outcome;
  } catch {
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: "Could not record authorization charge event row.",
    };
  }

  if (chargeRow.status === "paid" && chargeRow.zoho_payment_id) {
    return {
      ok: true,
      handled: true,
      source: "zoho_invoice_authorization_charge",
      invoiceNumber: chargeRow.invoice_number,
      status: "paid",
      idempotent: true,
    };
  }

  if (chargeEvent === "duplicate" && chargeRow.status === "paid" && chargeRow.zoho_payment_id) {
    return {
      ok: true,
      handled: true,
      source: "zoho_invoice_authorization_charge",
      invoiceNumber: chargeRow.invoice_number,
      status: "paid",
      idempotent: true,
    };
  }

  logZohoInvoicePaymentEvent("zoho_invoice_authorization_charge_verify_started", {
    invoiceNumber: chargeRow.invoice_number,
    paystackReference: charge.reference,
    authorizationChargeId: chargeRow.id,
  });

  let verifiedCharge: PaystackChargeSuccess | null = null;
  let verifiedCurrency = normalizeCurrency(chargeRow.currency);

  try {
    const verifyResponse = await paystackVerifyTransaction(charge.reference);
    verifiedCurrency = normalizeCurrency(verifyResponse.data.currency);
    verifiedCharge = mapPaystackVerifyData(verifyResponse.data);
  } catch (error) {
    const reason =
      error instanceof PaystackApiError
        ? `paystack_verify_api_${error.statusCode}`
        : "paystack_verify_failed";

    logZohoInvoicePaymentEvent("zoho_invoice_authorization_charge_verify_failed", {
      invoiceNumber: chargeRow.invoice_number,
      paystackReference: charge.reference,
      authorizationChargeId: chargeRow.id,
      failureCode: reason,
      retryable: true,
    });

    await markAuthorizationChargeReconcilePending(chargeRow.id, {
      paystackStatus: "verify_failed",
      reason,
    });

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice_authorization_charge",
      invoiceNumber: chargeRow.invoice_number,
      status: "zoho_reconcile_pending",
      idempotent: chargeEvent === "duplicate",
    };
  }

  if (!verifiedCharge) {
    logZohoInvoicePaymentEvent("zoho_invoice_authorization_charge_verify_failed", {
      invoiceNumber: chargeRow.invoice_number,
      paystackReference: charge.reference,
      authorizationChargeId: chargeRow.id,
      failureCode: "PAYSTACK_STATUS_NOT_SUCCESS",
      retryable: false,
    });

    await markAuthorizationChargeFailed(chargeRow.id, {
      paystackStatus: "verify_not_success",
      reason: "paystack_status_not_success",
    });

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice_authorization_charge",
      invoiceNumber: chargeRow.invoice_number,
      status: "zoho_reconcile_failed",
      idempotent: chargeEvent === "duplicate",
    };
  }

  logZohoInvoicePaymentEvent("zoho_invoice_authorization_charge_verify_succeeded", {
    invoiceNumber: chargeRow.invoice_number,
    paystackReference: charge.reference,
    authorizationChargeId: chargeRow.id,
    amountCents: verifiedCharge.amountCents,
    currency: verifiedCurrency,
  });

  if (verifiedCharge.amountCents !== chargeRow.amount_cents) {
    logZohoInvoicePaymentEvent("zoho_invoice_amount_mismatch", {
      invoiceNumber: chargeRow.invoice_number,
      paystackReference: charge.reference,
      authorizationChargeId: chargeRow.id,
      expectedAmountCents: chargeRow.amount_cents,
      actualAmountCents: verifiedCharge.amountCents,
    });

    await markAuthorizationChargeFailed(chargeRow.id, {
      paystackStatus: "success",
      reason: "amount_mismatch",
    });

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice_authorization_charge",
      invoiceNumber: chargeRow.invoice_number,
      status: "zoho_reconcile_failed",
      idempotent: chargeEvent === "duplicate",
    };
  }

  const rowCurrency = normalizeCurrency(chargeRow.currency);
  if (verifiedCurrency !== rowCurrency) {
    logZohoInvoicePaymentEvent("zoho_invoice_currency_mismatch", {
      invoiceNumber: chargeRow.invoice_number,
      paystackReference: charge.reference,
      authorizationChargeId: chargeRow.id,
      expectedCurrency: rowCurrency,
      actualCurrency: verifiedCurrency,
    });

    await markAuthorizationChargeFailed(chargeRow.id, {
      paystackStatus: "success",
      reason: "currency_mismatch",
    });

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice_authorization_charge",
      invoiceNumber: chargeRow.invoice_number,
      status: "zoho_reconcile_failed",
      idempotent: chargeEvent === "duplicate",
    };
  }

  if (chargeRow.zoho_payment_id) {
    await markAuthorizationChargePaid(
      chargeRow.id,
      {
        zohoPaymentId: chargeRow.zoho_payment_id,
        zohoStatus: chargeRow.zoho_status,
        paystackStatus: "success",
      },
      client,
    );

    logZohoInvoicePaymentEvent("zoho_invoice_authorization_charge_reconciled", {
      invoiceNumber: chargeRow.invoice_number,
      paystackReference: charge.reference,
      authorizationChargeId: chargeRow.id,
      zohoPaymentId: chargeRow.zoho_payment_id,
      idempotent: true,
    });

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice_authorization_charge",
      invoiceNumber: chargeRow.invoice_number,
      status: "paid",
      idempotent: true,
    };
  }

  const zohoResult = await createZohoCustomerPaymentForInvoice({
    zohoInvoiceId: chargeRow.zoho_invoice_id,
    invoiceNumber: chargeRow.invoice_number,
    customerEmail: chargeRow.customer_email,
    amountCents: chargeRow.amount_cents,
    currency: chargeRow.currency,
    paystackReference: charge.reference,
    paymentDate: new Date().toISOString(),
    notes: `Shalean admin saved-card charge ${charge.reference}`,
  });

  if (!zohoResult.ok) {
    await markAuthorizationChargeReconcilePending(chargeRow.id, {
      paystackStatus: "success",
      reason: zohoResult.code,
    });

    logZohoInvoicePaymentEvent("zoho_invoice_authorization_charge_reconcile_failed", {
      invoiceNumber: chargeRow.invoice_number,
      paystackReference: charge.reference,
      authorizationChargeId: chargeRow.id,
      failureCode: zohoResult.code,
      retryable: zohoResult.retryable,
    });

    return {
      ok: true,
      handled: true,
      source: "zoho_invoice_authorization_charge",
      invoiceNumber: chargeRow.invoice_number,
      status: "zoho_reconcile_pending",
      idempotent: chargeEvent === "duplicate",
    };
  }

  await markAuthorizationChargePaid(
    chargeRow.id,
    {
      zohoPaymentId: zohoResult.zohoPaymentId,
      zohoStatus: zohoResult.zohoStatus,
      paystackStatus: "success",
      metadata: {
        reconciled_via: "webhook",
      },
    },
    client,
  );

  logZohoInvoicePaymentEvent("zoho_invoice_authorization_charge_reconciled", {
    invoiceNumber: chargeRow.invoice_number,
    paystackReference: charge.reference,
    authorizationChargeId: chargeRow.id,
    zohoPaymentId: zohoResult.zohoPaymentId,
    idempotent: chargeEvent === "duplicate",
  });

  try {
    await markPaymentMethodLastUsed(
      {
        paymentMethodId: chargeRow.payment_method_id,
        invoiceNumber: chargeRow.invoice_number,
      },
      client,
    );
    logZohoInvoicePaymentEvent("zoho_invoice_payment_method_last_used_updated", {
      paymentMethodId: chargeRow.payment_method_id,
      invoiceNumber: chargeRow.invoice_number,
    });
  } catch {
    // Non-blocking after successful reconciliation.
  }

  return {
    ok: true,
    handled: true,
    source: "zoho_invoice_authorization_charge",
    invoiceNumber: chargeRow.invoice_number,
    status: "paid",
    idempotent: chargeEvent === "duplicate",
  };
}
