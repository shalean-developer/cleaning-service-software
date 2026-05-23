import "server-only";

import { centsToZohoDecimalAmount } from "./customerPayments";
import { getZohoInvoiceById } from "./invoices";
import { zohoBooksFetch, ZohoApiError } from "./zohoClient";
import { logZohoRefundCreditEvent } from "./zohoRefundCreditLogger";

export type CreateZohoCreditNoteForInvoiceInput = {
  zohoInvoiceId: string;
  invoiceNumber: string | null;
  customerId: string;
  amountCents: number;
  currency: string;
  reason: string;
  reference: string;
  lineItemName?: string;
};

export type CreateZohoCreditNoteForInvoiceResult =
  | { ok: true; zohoCreditNoteId: string; zohoStatus: string | null }
  | { ok: false; code: string; retryable: boolean };

export type ApplyZohoCreditNoteToInvoiceInput = {
  zohoCreditNoteId: string;
  zohoInvoiceId: string;
  invoiceNumber: string | null;
  amountCents: number;
};

export type ApplyZohoCreditNoteToInvoiceResult =
  | { ok: true }
  | { ok: false; code: string; retryable: boolean };

export type RecordZohoRefundForCreditNoteInput = {
  zohoCreditNoteId: string;
  amountCents: number;
  reference: string;
  reason: string;
  refundDate?: string;
};

export type RecordZohoRefundForCreditNoteResult =
  | { ok: true; zohoRefundId: string | null }
  | { ok: false; code: string; retryable: boolean };

type ZohoCreditNoteCreateResponse = {
  code: number;
  message?: string;
  creditnote?: {
    creditnote_id?: string;
    status?: string;
  };
};

type ZohoCreditNoteApplyResponse = {
  code: number;
  message?: string;
};

type ZohoCreditNoteRefundResponse = {
  code: number;
  message?: string;
  creditnote_refund?: {
    creditnote_refund_id?: string;
  };
};

function formatZohoDate(isoDate?: string): string {
  const parsed = isoDate ? new Date(isoDate) : new Date();
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

export function buildShaleanCreditNoteReference(sourceReference: string): string {
  return `SHALEAN-CR-${sourceReference}`;
}

/**
 * Creates a Zoho Books credit note for an invoice adjustment.
 * Does not void or delete the original invoice.
 */
export async function createZohoCreditNoteForInvoice(
  input: CreateZohoCreditNoteForInvoiceInput,
): Promise<CreateZohoCreditNoteForInvoiceResult> {
  const lookup = await getZohoInvoiceById(input.zohoInvoiceId);
  if (!lookup.ok) {
    return {
      ok: false,
      code: lookup.code === "NOT_FOUND" ? "ZOHO_INVOICE_NOT_FOUND" : "ZOHO_INVOICE_LOOKUP_FAILED",
      retryable: lookup.code === "API_ERROR" ? lookup.retryable : false,
    };
  }

  const amount = centsToZohoDecimalAmount(input.amountCents);
  const referenceNumber = buildShaleanCreditNoteReference(input.reference);
  const lineItemName = input.lineItemName?.trim() || "Refund / credit adjustment";

  try {
    const response = await zohoBooksFetch<ZohoCreditNoteCreateResponse>("/creditnotes", {
      method: "POST",
      body: JSON.stringify({
        customer_id: input.customerId,
        date: formatZohoDate(),
        reference_number: referenceNumber,
        currency_code: input.currency,
        line_items: [
          {
            name: lineItemName,
            description: input.reason,
            rate: amount,
            quantity: 1,
            invoice_id: input.zohoInvoiceId,
          },
        ],
        notes: input.reason,
      }),
    });

    const zohoCreditNoteId = response.creditnote?.creditnote_id?.trim();
    if (!zohoCreditNoteId) {
      return { ok: false, code: "ZOHO_CREDIT_NOTE_ID_MISSING", retryable: true };
    }

    logZohoRefundCreditEvent("zoho_credit_note_created", {
      invoiceNumber: input.invoiceNumber,
      zohoInvoiceId: input.zohoInvoiceId,
      amountCents: input.amountCents,
      reference: referenceNumber,
      zohoCreditNoteId,
    });

    return {
      ok: true,
      zohoCreditNoteId,
      zohoStatus: response.creditnote?.status?.trim() || null,
    };
  } catch (error) {
    const retryable = error instanceof ZohoApiError && error.statusCode >= 500;
    return {
      ok: false,
      code: error instanceof ZohoApiError ? error.code : "ZOHO_CREDIT_NOTE_CREATE_FAILED",
      retryable,
    };
  }
}

/**
 * Applies an existing credit note to an invoice.
 */
export async function applyZohoCreditNoteToInvoice(
  input: ApplyZohoCreditNoteToInvoiceInput,
): Promise<ApplyZohoCreditNoteToInvoiceResult> {
  const amountApplied = centsToZohoDecimalAmount(input.amountCents);

  try {
    await zohoBooksFetch<ZohoCreditNoteApplyResponse>(
      `/creditnotes/${encodeURIComponent(input.zohoCreditNoteId)}/invoices`,
      {
        method: "POST",
        body: JSON.stringify({
          invoices: [
            {
              invoice_id: input.zohoInvoiceId,
              amount_applied: amountApplied,
            },
          ],
        }),
      },
    );

    return { ok: true };
  } catch (error) {
    const retryable = error instanceof ZohoApiError && error.statusCode >= 500;
    logZohoRefundCreditEvent("zoho_credit_note_apply_failed", {
      invoiceNumber: input.invoiceNumber,
      zohoCreditNoteId: input.zohoCreditNoteId,
      zohoInvoiceId: input.zohoInvoiceId,
      failureCode: error instanceof ZohoApiError ? error.code : "ZOHO_CREDIT_NOTE_APPLY_FAILED",
      retryable,
    });
    return {
      ok: false,
      code: error instanceof ZohoApiError ? error.code : "ZOHO_CREDIT_NOTE_APPLY_FAILED",
      retryable,
    };
  }
}

/**
 * Records a refund against a credit note (accounting record when money was returned).
 */
export async function recordZohoRefundForCreditNote(
  input: RecordZohoRefundForCreditNoteInput,
): Promise<RecordZohoRefundForCreditNoteResult> {
  const amount = centsToZohoDecimalAmount(input.amountCents);

  try {
    const response = await zohoBooksFetch<ZohoCreditNoteRefundResponse>(
      `/creditnotes/${encodeURIComponent(input.zohoCreditNoteId)}/refunds`,
      {
        method: "POST",
        body: JSON.stringify({
          date: formatZohoDate(input.refundDate),
          refund_mode: "Paystack",
          reference_number: input.reference,
          amount,
          description: input.reason,
        }),
      },
    );

    const zohoRefundId = response.creditnote_refund?.creditnote_refund_id?.trim() || null;
    return { ok: true, zohoRefundId };
  } catch (error) {
    const retryable = error instanceof ZohoApiError && error.statusCode >= 500;
    return {
      ok: false,
      code: error instanceof ZohoApiError ? error.code : "ZOHO_CREDIT_NOTE_REFUND_FAILED",
      retryable,
    };
  }
}
