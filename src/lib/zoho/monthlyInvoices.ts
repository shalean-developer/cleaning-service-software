import "server-only";

import { findZohoInvoiceByReferenceNumber } from "@/lib/zoho/sales";
import { zohoBooksFetch, ZohoApiError } from "@/lib/zoho/zohoClient";
import type { ZohoMonthlyInvoicePayload } from "@/features/monthly-billing/server/buildZohoMonthlyInvoicePayload";

export type ZohoMonthlyInvoiceLineItemResult = {
  batchItemId: string;
  zohoLineItemId: string | null;
};

export type CreateZohoMonthlyInvoiceResult =
  | {
      ok: true;
      invoiceId: string;
      invoiceNumber: string | null;
      referenceNumber: string;
      lineItems: ZohoMonthlyInvoiceLineItemResult[];
    }
  | { ok: false; code: string; retryable: boolean; message?: string };

type ZohoInvoiceLineItemRecord = {
  line_item_id?: string;
  name?: string;
  description?: string;
  rate?: number;
};

type ZohoBooksSalesInvoiceRecord = {
  invoice_id: string;
  invoice_number?: string;
  reference_number?: string;
  line_items?: ZohoInvoiceLineItemRecord[];
};

type ZohoInvoiceCreateResponse = {
  code: number;
  message?: string;
  invoice?: ZohoBooksSalesInvoiceRecord;
};

function mapLineItemsFromResponse(
  payload: ZohoMonthlyInvoicePayload,
  batchItemIds: string[],
  invoice?: ZohoBooksSalesInvoiceRecord,
): ZohoMonthlyInvoiceLineItemResult[] {
  const zohoLines = invoice?.line_items ?? [];
  return batchItemIds.map((batchItemId, index) => ({
    batchItemId,
    zohoLineItemId: zohoLines[index]?.line_item_id?.trim() || null,
  }));
}

function matchExistingLineItems(
  payload: ZohoMonthlyInvoicePayload,
  batchItemIds: string[],
): ZohoMonthlyInvoiceLineItemResult[] {
  return batchItemIds.map((batchItemId) => ({
    batchItemId,
    zohoLineItemId: null,
  }));
}

export async function createZohoMonthlyInvoice(input: {
  payload: ZohoMonthlyInvoicePayload;
  batchItemIds: string[];
}): Promise<CreateZohoMonthlyInvoiceResult> {
  const existing = await findZohoInvoiceByReferenceNumber(input.payload.reference_number);
  if (existing) {
    if (!existing.ok) {
      return {
        ok: false,
        code: existing.code,
        retryable: existing.retryable,
        message: "Could not verify existing Zoho invoice by reference number.",
      };
    }
    return {
      ok: true,
      invoiceId: existing.zohoInvoiceId,
      invoiceNumber: existing.invoiceNumber,
      referenceNumber: input.payload.reference_number,
      lineItems: matchExistingLineItems(input.payload, input.batchItemIds),
    };
  }

  try {
    const response = await zohoBooksFetch<ZohoInvoiceCreateResponse>("/invoices", {
      method: "POST",
      body: JSON.stringify({
        customer_id: input.payload.customer_id,
        reference_number: input.payload.reference_number,
        date: input.payload.date,
        due_date: input.payload.due_date,
        currency_code: input.payload.currency_code,
        line_items: input.payload.line_items.map((line) => ({
          name: line.name,
          description: line.description,
          rate: line.rate,
          quantity: line.quantity,
        })),
        terms: input.payload.terms,
      }),
    });

    const invoice = response.invoice;
    const invoiceId = invoice?.invoice_id?.trim();
    if (!invoiceId) {
      return { ok: false, code: "ZOHO_INVOICE_ID_MISSING", retryable: true };
    }

    return {
      ok: true,
      invoiceId,
      invoiceNumber: invoice?.invoice_number?.trim() || null,
      referenceNumber: input.payload.reference_number,
      lineItems: mapLineItemsFromResponse(input.payload, input.batchItemIds, invoice),
    };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof ZohoApiError ? error.code : "ZOHO_INVOICE_CREATE_FAILED",
      retryable: error instanceof ZohoApiError && error.statusCode >= 500,
      message: error instanceof Error ? error.message : "Zoho invoice creation failed.",
    };
  }
}

export type { ZohoMonthlyInvoicePayload };
