import "server-only";

import {
  buildSafeInvoiceFieldsFromZoho,
  extractZohoInvoiceCustomerEmail,
  getZohoInvoiceByNumber,
  zohoAmountToCents,
} from "@/lib/zoho/invoices";
import { isZohoBooksEnabled } from "@/lib/zoho/zohoEnv";
import { isZohoApiError, isZohoConfigError } from "@/lib/zoho/zohoClient";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import { paystackInitializeTransaction, PaystackApiError } from "@/features/payments/server/paystackClient";
import { isPaystackEnabled, PaystackConfigError } from "@/features/payments/server/paystackEnv";
import { validateAndNormalizeInvoiceNumber } from "./invoiceNumberValidation";
import { mapZohoInvoiceToPublicStatus } from "./mapZohoInvoiceToPublicStatus";
import { buildZohoInvoicePaystackCallbackUrl } from "./buildZohoInvoicePaystackCallbackUrl";
import { buildZohoInvoicePaystackReference } from "./buildZohoInvoicePaystackReference";
import {
  cancelActiveZohoInvoicePaymentAttempt,
  createZohoInvoicePaymentAttempt,
  findActiveZohoInvoicePaymentByInvoiceNumber,
  markZohoInvoicePaymentInitializeFailed,
  mergeZohoInvoicePaymentMetadata,
  updateZohoInvoicePaymentPaystackInitialized,
} from "./zohoInvoicePaymentRepository";
import {
  buildSavePaymentMethodConsentMetadata,
  ZOHO_INVOICE_SAVE_PAYMENT_METHOD_CONSENT_VERSION,
} from "./zohoInvoiceSavePaymentMethodConsent";
import {
  isZohoSavedMethodsEnabled,
  requireZohoInvoicePaymentsEnabled,
} from "./zohoPaymentLaunchGuard";

export type InitializeZohoInvoicePaymentSuccess = {
  ok: true;
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
};

export type InitializeZohoInvoicePaymentFailure = {
  ok: false;
  code:
    | "INVALID_INVOICE_NUMBER"
    | "NOT_CONFIGURED"
    | "PAYSTACK_DISABLED"
    | "CALLBACK_URL_MISSING"
    | "NOT_FOUND"
    | "NOT_PAYABLE"
    | "MISSING_CUSTOMER_EMAIL"
    | "INVALID_AMOUNT"
    | "ZOHO_API_ERROR"
    | "PAYSTACK_INIT_FAILED"
    | "PERSISTENCE_ERROR"
    | "INVOICE_PAYMENTS_DISABLED"
    | "SAVED_METHODS_DISABLED";
  message: string;
  status: number;
};

export type InitializeZohoInvoicePaymentResult =
  | InitializeZohoInvoicePaymentSuccess
  | InitializeZohoInvoicePaymentFailure;

const PUBLIC_MESSAGES = {
  NOT_CONFIGURED: "Online invoice payments are not available yet.",
  PAYSTACK_DISABLED: "Online card payments are temporarily unavailable.",
  CALLBACK_URL_MISSING: "Payment checkout is not configured for this site.",
  NOT_FOUND: "We could not find this invoice.",
  NOT_PAYABLE: "This invoice is not available for online payment.",
  MISSING_CUSTOMER_EMAIL: "This invoice cannot be paid online yet. Please contact Shalean.",
  INVALID_AMOUNT: "This invoice has no outstanding balance to pay.",
  ZOHO_API_ERROR: "We could not start payment for this invoice. Please try again later.",
  PAYSTACK_INIT_FAILED: "We could not start payment for this invoice. Please try again later.",
  PERSISTENCE_ERROR: "We could not start payment for this invoice. Please try again later.",
  INVOICE_PAYMENTS_DISABLED: "Online invoice payments are temporarily unavailable.",
  SAVED_METHODS_DISABLED: "Saved payment methods are temporarily unavailable.",
} as const;

function failure(
  code: InitializeZohoInvoicePaymentFailure["code"],
  message: string,
  status: number,
): InitializeZohoInvoicePaymentFailure {
  return { ok: false, code, message, status };
}

function isReusablePendingPayment(
  payment: Awaited<ReturnType<typeof findActiveZohoInvoicePaymentByInvoiceNumber>>,
  amountCents: number,
): payment is NonNullable<typeof payment> {
  if (!payment) return false;
  if (payment.amount_cents !== amountCents) return false;
  return Boolean(payment.paystack_authorization_url?.trim());
}

export type InitializeZohoInvoicePaymentOptions = {
  savePaymentMethodConsent?: boolean;
};

export async function initializeZohoInvoicePayment(
  rawInvoiceNumber: string,
  options: InitializeZohoInvoicePaymentOptions = {},
): Promise<InitializeZohoInvoicePaymentResult> {
  const validated = validateAndNormalizeInvoiceNumber(rawInvoiceNumber);
  if (!validated.ok) {
    logZohoInvoicePaymentEvent("invoice_number_invalid", {
      invoiceNumber: rawInvoiceNumber?.trim() || null,
      reason: validated.message,
    });
    return failure("INVALID_INVOICE_NUMBER", validated.message, 400);
  }

  const { normalized } = validated;
  let savePaymentMethodConsent = options.savePaymentMethodConsent === true;

  const invoicePaymentsGate = requireZohoInvoicePaymentsEnabled();
  if (!invoicePaymentsGate.ok) {
    logZohoInvoicePaymentEvent("zoho_invoice_payments_feature_disabled", {
      invoiceNumber: normalized,
      reason: "initialize",
    });
    return failure(
      "INVOICE_PAYMENTS_DISABLED",
      PUBLIC_MESSAGES.INVOICE_PAYMENTS_DISABLED,
      invoicePaymentsGate.status,
    );
  }

  if (savePaymentMethodConsent && !isZohoSavedMethodsEnabled()) {
    logZohoInvoicePaymentEvent("zoho_saved_methods_feature_disabled", {
      invoiceNumber: normalized,
      reason: "initialize_consent_stripped",
    });
    savePaymentMethodConsent = false;
  }

  logZohoInvoicePaymentEvent("zoho_invoice_initialize_started", {
    invoiceNumber: normalized,
    savePaymentMethodConsent,
  });

  if (savePaymentMethodConsent) {
    logZohoInvoicePaymentEvent("zoho_invoice_save_method_consent_requested", {
      invoiceNumber: normalized,
      consentTextVersion: ZOHO_INVOICE_SAVE_PAYMENT_METHOD_CONSENT_VERSION,
    });
  }

  if (!isZohoBooksEnabled()) {
    logZohoInvoicePaymentEvent("zoho_not_configured", {
      invoiceNumber: normalized,
      reason: "initialize",
    });
    return failure("NOT_CONFIGURED", PUBLIC_MESSAGES.NOT_CONFIGURED, 503);
  }

  if (!isPaystackEnabled()) {
    return failure("PAYSTACK_DISABLED", PUBLIC_MESSAGES.PAYSTACK_DISABLED, 503);
  }

  logZohoInvoicePaymentEvent("zoho_invoice_fetch_started", {
    invoiceNumber: normalized,
    operation: "initialize_fetch_invoice_by_number",
  });

  let lookup: Awaited<ReturnType<typeof getZohoInvoiceByNumber>>;
  try {
    lookup = await getZohoInvoiceByNumber(normalized);
  } catch (error) {
    if (isZohoConfigError(error)) {
      return failure("NOT_CONFIGURED", PUBLIC_MESSAGES.NOT_CONFIGURED, 503);
    }
    logZohoInvoicePaymentEvent("zoho_invoice_fetch_failed", {
      invoiceNumber: normalized,
      failureCode: isZohoApiError(error) ? error.code : "UNEXPECTED_ERROR",
    });
    return failure("ZOHO_API_ERROR", PUBLIC_MESSAGES.ZOHO_API_ERROR, 502);
  }

  if (!lookup.ok) {
    if (lookup.code === "NOT_FOUND") {
      logZohoInvoicePaymentEvent("zoho_invoice_not_found", { invoiceNumber: normalized });
      return failure("NOT_FOUND", PUBLIC_MESSAGES.NOT_FOUND, 404);
    }
    logZohoInvoicePaymentEvent("zoho_invoice_fetch_failed", {
      invoiceNumber: normalized,
      failureCode: lookup.code,
    });
    return failure("ZOHO_API_ERROR", PUBLIC_MESSAGES.ZOHO_API_ERROR, 502);
  }

  const fields = buildSafeInvoiceFieldsFromZoho(lookup.invoice);
  const publicStatus = mapZohoInvoiceToPublicStatus({
    zohoStatus: lookup.invoice.status,
    balanceCents: fields.amountDueCents,
    invoiceTotalCents: zohoAmountToCents(lookup.invoice.total),
  });

  if (publicStatus !== "payable") {
    logZohoInvoicePaymentEvent("zoho_invoice_initialize_blocked_not_payable", {
      invoiceNumber: normalized,
      publicStatus,
      zohoStatus: lookup.invoice.status ?? null,
    });
    return failure("NOT_PAYABLE", PUBLIC_MESSAGES.NOT_PAYABLE, 409);
  }

  if (fields.amountDueCents <= 0) {
    logZohoInvoicePaymentEvent("zoho_invoice_initialize_blocked_not_payable", {
      invoiceNumber: normalized,
      reason: "amount_due_zero",
      balanceCents: fields.amountDueCents,
    });
    return failure("INVALID_AMOUNT", PUBLIC_MESSAGES.INVALID_AMOUNT, 409);
  }

  const customerEmail = extractZohoInvoiceCustomerEmail(lookup.invoice);
  if (!customerEmail) {
    logZohoInvoicePaymentEvent("zoho_invoice_initialize_blocked_not_payable", {
      invoiceNumber: normalized,
      reason: "missing_customer_email",
    });
    return failure("MISSING_CUSTOMER_EMAIL", PUBLIC_MESSAGES.MISSING_CUSTOMER_EMAIL, 409);
  }

  let activePayment = await findActiveZohoInvoicePaymentByInvoiceNumber(normalized);

  if (activePayment && activePayment.amount_cents !== fields.amountDueCents) {
    await cancelActiveZohoInvoicePaymentAttempt(activePayment.id, "amount_mismatch");
    activePayment = null;
  }

  if (isReusablePendingPayment(activePayment, fields.amountDueCents)) {
    if (savePaymentMethodConsent) {
      await mergeZohoInvoicePaymentMetadata(
        activePayment.id,
        buildSavePaymentMethodConsentMetadata(),
      );
    } else {
      await mergeZohoInvoicePaymentMetadata(activePayment.id, {
        save_payment_method_requested: false,
      });
    }

    logZohoInvoicePaymentEvent("zoho_invoice_initialize_reused_pending", {
      invoiceNumber: normalized,
      zohoInvoicePaymentId: activePayment.id,
      paystackReference: activePayment.paystack_reference,
      amountCents: activePayment.amount_cents,
    });
    return {
      ok: true,
      authorizationUrl: activePayment.paystack_authorization_url!,
      accessCode: activePayment.paystack_access_code ?? "",
      reference: activePayment.paystack_reference ?? "",
      invoiceNumber: fields.invoiceNumber,
      amountCents: activePayment.amount_cents,
      currency: activePayment.currency,
    };
  }

  if (activePayment) {
    await cancelActiveZohoInvoicePaymentAttempt(activePayment.id, "stale_active_attempt");
  }

  let paymentAttempt: Awaited<ReturnType<typeof createZohoInvoicePaymentAttempt>>;
  try {
    const attemptMetadata: Record<string, unknown> = {
      zoho_status: lookup.invoice.status ?? null,
    };
    if (savePaymentMethodConsent) {
      Object.assign(attemptMetadata, buildSavePaymentMethodConsentMetadata());
    }

    paymentAttempt = await createZohoInvoicePaymentAttempt({
      invoiceNumber: normalized,
      zohoInvoiceId: lookup.invoice.invoice_id,
      customerName: fields.customerName,
      customerEmail,
      amountCents: fields.amountDueCents,
      currency: fields.currency,
      idempotencyKey: `zoho-invoice:init:${normalized}:${crypto.randomUUID()}`,
      metadata: attemptMetadata,
    });
  } catch {
    return failure("PERSISTENCE_ERROR", PUBLIC_MESSAGES.PERSISTENCE_ERROR, 500);
  }

  logZohoInvoicePaymentEvent("zoho_invoice_payment_attempt_created", {
    invoiceNumber: normalized,
    zohoInvoicePaymentId: paymentAttempt.id,
    amountCents: paymentAttempt.amount_cents,
    currency: paymentAttempt.currency,
  });

  const reference = buildZohoInvoicePaystackReference(normalized, paymentAttempt.id);
  const callbackUrl = buildZohoInvoicePaystackCallbackUrl(fields.invoiceNumber, reference);
  if (!callbackUrl) {
    await markZohoInvoicePaymentInitializeFailed(paymentAttempt.id, "callback_url_missing");
    return failure("CALLBACK_URL_MISSING", PUBLIC_MESSAGES.CALLBACK_URL_MISSING, 503);
  }

  logZohoInvoicePaymentEvent("zoho_invoice_paystack_initialize_started", {
    invoiceNumber: normalized,
    zohoInvoicePaymentId: paymentAttempt.id,
    paystackReference: reference,
    amountCents: fields.amountDueCents,
  });

  try {
    const paystackMetadata: Record<string, string | number | boolean | null> = {
      source: "zoho_invoice",
      invoice_number: normalized,
      zoho_invoice_id: lookup.invoice.invoice_id,
      zoho_invoice_payment_id: paymentAttempt.id,
    };
    if (savePaymentMethodConsent) {
      paystackMetadata.save_payment_method_requested = true;
      paystackMetadata.consent_text_version = ZOHO_INVOICE_SAVE_PAYMENT_METHOD_CONSENT_VERSION;
    }

    const paystack = await paystackInitializeTransaction({
      email: customerEmail,
      amount: fields.amountDueCents,
      reference,
      currency: fields.currency,
      callback_url: callbackUrl,
      metadata: paystackMetadata,
    });

    await updateZohoInvoicePaymentPaystackInitialized(paymentAttempt.id, {
      paystackReference: paystack.data.reference,
      paystackAccessCode: paystack.data.access_code,
      paystackAuthorizationUrl: paystack.data.authorization_url,
      paystackStatus: "initialized",
    });

    logZohoInvoicePaymentEvent("zoho_invoice_paystack_initialize_succeeded", {
      invoiceNumber: normalized,
      zohoInvoicePaymentId: paymentAttempt.id,
      paystackReference: paystack.data.reference,
      amountCents: fields.amountDueCents,
    });

    return {
      ok: true,
      authorizationUrl: paystack.data.authorization_url,
      accessCode: paystack.data.access_code,
      reference: paystack.data.reference,
      invoiceNumber: fields.invoiceNumber,
      amountCents: fields.amountDueCents,
      currency: fields.currency,
    };
  } catch (error) {
    const reason =
      error instanceof PaystackApiError
        ? `paystack_api_${error.statusCode}`
        : error instanceof PaystackConfigError
          ? error.code
          : "paystack_initialize_failed";

    await markZohoInvoicePaymentInitializeFailed(paymentAttempt.id, reason);

    logZohoInvoicePaymentEvent("zoho_invoice_paystack_initialize_failed", {
      invoiceNumber: normalized,
      zohoInvoicePaymentId: paymentAttempt.id,
      paystackReference: reference,
      failureCode: reason,
    });

    return failure("PAYSTACK_INIT_FAILED", PUBLIC_MESSAGES.PAYSTACK_INIT_FAILED, 502);
  }
}
