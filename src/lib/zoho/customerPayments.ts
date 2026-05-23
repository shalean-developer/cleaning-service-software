import "server-only";

import { zohoAmountToCents, getZohoInvoiceById } from "./invoices";
import { zohoBooksFetch, ZohoApiError } from "./zohoClient";
import { logZohoInvoicePaymentEvent } from "./zohoInvoicePaymentLogger";

export type CreateZohoCustomerPaymentForInvoiceInput = {
  zohoInvoiceId: string;
  invoiceNumber: string;
  customerEmail: string;
  amountCents: number;
  currency: string;
  paystackReference: string;
  paymentDate: string;
  notes?: string;
};

export type CreateZohoCustomerPaymentForInvoiceResult =
  | { ok: true; zohoPaymentId: string; zohoStatus: string | null }
  | { ok: false; code: string; retryable: boolean };

type ZohoCustomerPaymentCreateResponse = {
  code: number;
  message?: string;
  payment?: {
    payment_id?: string;
    status?: string;
  };
};

export function centsToZohoDecimalAmount(amountCents: number): number {
  return Number((amountCents / 100).toFixed(2));
}

function formatZohoPaymentDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

/**
 * Creates a Zoho Books customer payment applied to a single invoice.
 */
export async function createZohoCustomerPaymentForInvoice(
  input: CreateZohoCustomerPaymentForInvoiceInput,
): Promise<CreateZohoCustomerPaymentForInvoiceResult> {
  const lookup = await getZohoInvoiceById(input.zohoInvoiceId);
  if (!lookup.ok) {
    logZohoInvoicePaymentEvent("zoho_invoice_zoho_reconcile_failed", {
      invoiceNumber: input.invoiceNumber,
      paystackReference: input.paystackReference,
      failureCode: lookup.code === "NOT_FOUND" ? "ZOHO_INVOICE_NOT_FOUND" : "ZOHO_INVOICE_LOOKUP_FAILED",
      retryable: lookup.code === "API_ERROR" ? lookup.retryable : false,
    });
    return {
      ok: false,
      code: lookup.code === "NOT_FOUND" ? "ZOHO_INVOICE_NOT_FOUND" : "ZOHO_INVOICE_LOOKUP_FAILED",
      retryable: lookup.code === "API_ERROR" ? lookup.retryable : false,
    };
  }

  const customerId = lookup.invoice.customer_id?.trim();
  if (!customerId) {
    logZohoInvoicePaymentEvent("zoho_invoice_zoho_reconcile_failed", {
      invoiceNumber: input.invoiceNumber,
      paystackReference: input.paystackReference,
      failureCode: "ZOHO_CUSTOMER_ID_MISSING",
      retryable: false,
    });
    return { ok: false, code: "ZOHO_CUSTOMER_ID_MISSING", retryable: false };
  }

  const amountApplied = centsToZohoDecimalAmount(input.amountCents);
  const description =
    input.notes?.trim() ||
    `Shalean Paystack payment ${input.paystackReference} for invoice ${input.invoiceNumber}`;

  logZohoInvoicePaymentEvent("zoho_invoice_zoho_reconcile_started", {
    invoiceNumber: input.invoiceNumber,
    paystackReference: input.paystackReference,
    amountCents: input.amountCents,
    currency: input.currency,
  });

  try {
    const response = await zohoBooksFetch<ZohoCustomerPaymentCreateResponse>("/customerpayments", {
      method: "POST",
      body: JSON.stringify({
        customer_id: customerId,
        payment_mode: "Paystack",
        amount: amountApplied,
        date: formatZohoPaymentDate(input.paymentDate),
        reference_number: input.paystackReference,
        description,
        invoices: [
          {
            invoice_id: input.zohoInvoiceId,
            amount_applied: amountApplied,
          },
        ],
      }),
    });

    const zohoPaymentId = response.payment?.payment_id?.trim();
    if (!zohoPaymentId) {
      logZohoInvoicePaymentEvent("zoho_invoice_zoho_reconcile_failed", {
        invoiceNumber: input.invoiceNumber,
        paystackReference: input.paystackReference,
        failureCode: "ZOHO_PAYMENT_ID_MISSING",
        retryable: true,
      });
      return { ok: false, code: "ZOHO_PAYMENT_ID_MISSING", retryable: true };
    }

    logZohoInvoicePaymentEvent("zoho_invoice_zoho_reconcile_succeeded", {
      invoiceNumber: input.invoiceNumber,
      paystackReference: input.paystackReference,
      zohoPaymentId,
      amountCents: input.amountCents,
    });

    return {
      ok: true,
      zohoPaymentId,
      zohoStatus: response.payment?.status?.trim() || null,
    };
  } catch (error) {
    const retryable = error instanceof ZohoApiError && error.statusCode >= 500;
    logZohoInvoicePaymentEvent("zoho_invoice_zoho_reconcile_failed", {
      invoiceNumber: input.invoiceNumber,
      paystackReference: input.paystackReference,
      failureCode: error instanceof ZohoApiError ? error.code : "ZOHO_PAYMENT_CREATE_FAILED",
      retryable,
    });
    return {
      ok: false,
      code: error instanceof ZohoApiError ? error.code : "ZOHO_PAYMENT_CREATE_FAILED",
      retryable,
    };
  }
}

/** @internal exported for tests */
export function verifyZohoInvoiceBalanceForPayment(
  invoiceBalanceCents: number,
  amountCents: number,
): boolean {
  return invoiceBalanceCents >= amountCents;
}

/** @internal exported for tests */
export { zohoAmountToCents };
