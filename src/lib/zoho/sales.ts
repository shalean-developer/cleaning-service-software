import "server-only";

import { centsToZohoDecimalAmount, createZohoCustomerPaymentForInvoice } from "./customerPayments";
import { zohoBooksFetch, ZohoApiError } from "./zohoClient";

export type ZohoBooksSalesInvoiceRecord = {
  invoice_id: string;
  invoice_number?: string;
  customer_id?: string;
  reference_number?: string;
  status?: string;
};

type ZohoInvoiceCreateResponse = {
  code: number;
  message?: string;
  invoice?: ZohoBooksSalesInvoiceRecord;
};

type ZohoInvoicesListResponse = {
  code: number;
  message?: string;
  invoices?: ZohoBooksSalesInvoiceRecord[];
};

export type CreateZohoBookingSalesInvoiceInput = {
  customerId: string;
  bookingId: string;
  serviceName: string;
  bookingDate: string;
  amountCents: number;
  currency: string;
  paystackReference: string;
};

export type CreateZohoBookingSalesInvoiceResult =
  | {
      ok: true;
      zohoInvoiceId: string;
      invoiceNumber: string | null;
      zohoCustomerId: string | null;
    }
  | { ok: false; code: string; retryable: boolean };

export function buildBookingZohoReferenceNumber(bookingId: string): string {
  return `SHALEAN-BKG-${bookingId}`;
}

function formatZohoInvoiceDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

export async function findZohoInvoiceByReferenceNumber(
  referenceNumber: string,
): Promise<CreateZohoBookingSalesInvoiceResult | null> {
  try {
    const response = await zohoBooksFetch<ZohoInvoicesListResponse>(
      `/invoices?reference_number=${encodeURIComponent(referenceNumber)}`,
    );
    const invoice = response.invoices?.[0];
    if (!invoice?.invoice_id) {
      return null;
    }
    return {
      ok: true,
      zohoInvoiceId: invoice.invoice_id,
      invoiceNumber: invoice.invoice_number?.trim() || null,
      zohoCustomerId: invoice.customer_id?.trim() || null,
    };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof ZohoApiError ? error.code : "ZOHO_INVOICE_LOOKUP_FAILED",
      retryable: error instanceof ZohoApiError && error.statusCode >= 500,
    };
  }
}

export async function createZohoBookingSalesInvoice(
  input: CreateZohoBookingSalesInvoiceInput,
): Promise<CreateZohoBookingSalesInvoiceResult> {
  const referenceNumber = buildBookingZohoReferenceNumber(input.bookingId);
  const existing = await findZohoInvoiceByReferenceNumber(referenceNumber);
  if (existing) {
    if (!existing.ok) return existing;
    return existing;
  }

  const rate = centsToZohoDecimalAmount(input.amountCents);
  const notes = "Paid through Shalean online booking system.";

  try {
    const response = await zohoBooksFetch<ZohoInvoiceCreateResponse>("/invoices", {
      method: "POST",
      body: JSON.stringify({
        customer_id: input.customerId,
        reference_number: referenceNumber,
        date: formatZohoInvoiceDate(input.bookingDate),
        currency_code: input.currency,
        line_items: [
          {
            name: input.serviceName,
            description: `Shalean booking ${input.bookingId}`,
            rate,
            quantity: 1,
          },
        ],
        notes,
        terms: `Paystack reference: ${input.paystackReference}`,
      }),
    });

    const invoice = response.invoice;
    const zohoInvoiceId = invoice?.invoice_id?.trim();
    if (!zohoInvoiceId) {
      return { ok: false, code: "ZOHO_INVOICE_ID_MISSING", retryable: true };
    }

    await markZohoInvoiceSent(zohoInvoiceId);

    return {
      ok: true,
      zohoInvoiceId,
      invoiceNumber: invoice?.invoice_number?.trim() || null,
      zohoCustomerId: invoice?.customer_id?.trim() || input.customerId,
    };
  } catch (error) {
    return {
      ok: false,
      code: error instanceof ZohoApiError ? error.code : "ZOHO_INVOICE_CREATE_FAILED",
      retryable: error instanceof ZohoApiError && error.statusCode >= 500,
    };
  }
}

export async function markZohoInvoiceSent(invoiceId: string): Promise<void> {
  await zohoBooksFetch(`/invoices/${encodeURIComponent(invoiceId)}/status/sent`, {
    method: "POST",
  });
}

export async function recordZohoBookingCustomerPayment(input: {
  zohoInvoiceId: string;
  invoiceNumber: string | null;
  customerEmail: string;
  amountCents: number;
  currency: string;
  paystackReference: string;
  paymentDate: string;
}): Promise<
  | { ok: true; zohoPaymentId: string; zohoStatus: string | null }
  | { ok: false; code: string; retryable: boolean }
> {
  return createZohoCustomerPaymentForInvoice({
    zohoInvoiceId: input.zohoInvoiceId,
    invoiceNumber: input.invoiceNumber ?? input.zohoInvoiceId,
    customerEmail: input.customerEmail,
    amountCents: input.amountCents,
    currency: input.currency,
    paystackReference: input.paystackReference,
    paymentDate: input.paymentDate,
    notes: "Paid through Shalean online booking system.",
  });
}
