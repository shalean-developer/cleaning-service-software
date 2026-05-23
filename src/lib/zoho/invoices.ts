import "server-only";

import { mapZohoInvoiceToPublicStatus } from "@/features/zoho-invoice-payments/server/mapZohoInvoiceToPublicStatus";
import { logZohoInvoiceFetchFailureDev } from "./zohoInvoicePaymentLogger";
import { zohoBooksFetch, ZohoApiError } from "./zohoClient";

export type ZohoBooksInvoiceLineItem = {
  name?: string;
  description?: string;
  quantity?: number;
  rate?: number;
  item_total?: number;
};

export type ZohoBooksInvoiceRecord = {
  invoice_id: string;
  invoice_number: string;
  customer_id?: string;
  customer_name?: string;
  email?: string;
  customer_email?: string;
  status?: string;
  balance?: number;
  total?: number;
  currency_code?: string;
  due_date?: string;
  line_items?: ZohoBooksInvoiceLineItem[];
};

type ZohoInvoicesListResponse = {
  code: number;
  message?: string;
  invoices?: ZohoBooksInvoiceRecord[];
};

export type ZohoInvoiceLookupResult =
  | { ok: true; invoice: ZohoBooksInvoiceRecord }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "API_ERROR"; retryable: boolean };

type InvoiceLookupMethod = "invoice_number" | "search_text";

function normalizeInvoiceNumberForMatch(value: string): string {
  return value.trim().toUpperCase();
}

function pickExactInvoiceMatch(
  invoices: ZohoBooksInvoiceRecord[] | undefined,
  invoiceNumber: string,
): ZohoBooksInvoiceRecord | null {
  if (!invoices?.length) return null;

  const target = normalizeInvoiceNumberForMatch(invoiceNumber);
  const exactMatches = invoices.filter(
    (invoice) =>
      invoice.invoice_number &&
      normalizeInvoiceNumberForMatch(invoice.invoice_number) === target,
  );

  return exactMatches[0] ?? null;
}

function isInvoiceSummaryOnly(invoice: ZohoBooksInvoiceRecord): boolean {
  return invoice.line_items === undefined;
}

function logInvoiceLookupFailure(
  error: unknown,
  context: {
    endpointPath: string;
    queryParams: Record<string, string>;
    invoiceNumber: string;
    lookupMethod: InvoiceLookupMethod;
    reason?: string;
    zohoResponseCode?: number;
    zohoResponseMessage?: string;
    httpStatus?: number;
  },
): void {
  logZohoInvoiceFetchFailureDev({
    httpStatus:
      context.httpStatus ??
      (error instanceof ZohoApiError ? error.statusCode : null),
    zohoResponseCode:
      context.zohoResponseCode ??
      (error instanceof ZohoApiError ? error.zohoResponseCode ?? null : null),
    zohoResponseMessage:
      context.zohoResponseMessage ??
      (error instanceof ZohoApiError ? error.message : null),
    endpointPath: context.endpointPath,
    queryParams: context.queryParams,
    invoiceNumber: context.invoiceNumber,
    lookupMethod: context.lookupMethod,
    reason: context.reason ?? null,
  });
}

async function ensureFullZohoInvoice(
  invoice: ZohoBooksInvoiceRecord,
  invoiceNumber: string,
  lookupMethod: InvoiceLookupMethod,
): Promise<ZohoInvoiceLookupResult> {
  if (!isInvoiceSummaryOnly(invoice)) {
    return { ok: true, invoice };
  }

  const full = await getZohoInvoiceById(invoice.invoice_id);
  if (full.ok) {
    return full;
  }

  if (full.code === "NOT_FOUND") {
    logZohoInvoiceFetchFailureDev({
      httpStatus: null,
      zohoResponseCode: null,
      zohoResponseMessage: "Summary invoice found but detail fetch returned NOT_FOUND",
      endpointPath: `/invoices/${encodeURIComponent(invoice.invoice_id)}`,
      queryParams: { organization_id: "[resolved-by-client]" },
      invoiceNumber,
      lookupMethod,
      reason: "detail_fetch_not_found",
    });
    return full;
  }

  return full;
}

async function fetchZohoInvoiceListByQuery(
  queryParams: Record<string, string>,
  invoiceNumber: string,
  lookupMethod: InvoiceLookupMethod,
): Promise<ZohoInvoiceLookupResult> {
  const search = new URLSearchParams(queryParams);
  const endpointPath = `/invoices?${search.toString()}`;

  try {
    const response = await zohoBooksFetch<ZohoInvoicesListResponse>(endpointPath, {
      method: "GET",
    });

    const invoice = pickExactInvoiceMatch(response.invoices, invoiceNumber);
    if (!invoice?.invoice_id || !invoice.invoice_number) {
      logZohoInvoiceFetchFailureDev({
        httpStatus: 200,
        zohoResponseCode: response.code,
        zohoResponseMessage: response.message ?? null,
        endpointPath: "/invoices",
        queryParams,
        invoiceNumber,
        lookupMethod,
        reason: "no_exact_match",
      });
      return { ok: false, code: "NOT_FOUND" };
    }

    return ensureFullZohoInvoice(invoice, invoiceNumber, lookupMethod);
  } catch (error) {
    logInvoiceLookupFailure(error, {
      endpointPath: "/invoices",
      queryParams,
      invoiceNumber,
      lookupMethod,
      reason: "request_failed",
    });

    if (error instanceof ZohoApiError && error.statusCode === 404) {
      return { ok: false, code: "NOT_FOUND" };
    }

    return { ok: false, code: "API_ERROR", retryable: true };
  }
}

/** Converts Zoho currency amounts (major units) to integer cents. */
export function zohoAmountToCents(amount: number | undefined | null): number {
  if (amount == null || !Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function mapLineItem(item: ZohoBooksInvoiceLineItem) {
  const name = (item.name || item.description || "Item").trim() || "Item";
  return {
    name,
    quantity: typeof item.quantity === "number" ? item.quantity : null,
    rateCents: zohoAmountToCents(item.rate),
    totalCents: zohoAmountToCents(item.item_total),
  };
}

export function mapZohoInvoiceLineItems(
  lineItems: ZohoBooksInvoiceLineItem[] | undefined,
): ReturnType<typeof mapLineItem>[] {
  if (!lineItems?.length) return [];
  return lineItems.map(mapLineItem);
}

export type ZohoInvoicePaymentStatus = "payable" | "paid" | "void";

/** @deprecated Use mapZohoInvoiceToPublicStatus for new code. */
export function resolveZohoInvoicePaymentStatus(
  invoice: ZohoBooksInvoiceRecord,
): ZohoInvoicePaymentStatus {
  const balanceCents = zohoAmountToCents(Math.max(0, invoice.balance ?? invoice.total ?? 0));
  const status = mapZohoInvoiceToPublicStatus({
    zohoStatus: invoice.status,
    balanceCents,
    invoiceTotalCents: zohoAmountToCents(invoice.total),
  });

  if (status === "payable" || status === "paid" || status === "void") {
    return status;
  }

  return "payable";
}

type ZohoInvoiceDetailResponse = {
  code: number;
  message?: string;
  invoice?: ZohoBooksInvoiceRecord;
};

/**
 * Fetches a single invoice by Zoho invoice id from Zoho Books.
 */
export async function getZohoInvoiceById(
  invoiceId: string,
): Promise<ZohoInvoiceLookupResult> {
  const encoded = encodeURIComponent(invoiceId);

  try {
    const response = await zohoBooksFetch<ZohoInvoiceDetailResponse>(
      `/invoices/${encoded}`,
      { method: "GET" },
    );

    const invoice = response.invoice;
    if (!invoice?.invoice_id || !invoice.invoice_number) {
      return { ok: false, code: "NOT_FOUND" };
    }

    return { ok: true, invoice };
  } catch (error) {
    logInvoiceLookupFailure(error, {
      endpointPath: `/invoices/${encoded}`,
      queryParams: { organization_id: "[resolved-by-client]" },
      invoiceNumber: invoiceId,
      lookupMethod: "invoice_number",
      reason: "detail_fetch_failed",
    });

    if (error instanceof ZohoApiError && error.statusCode === 404) {
      return { ok: false, code: "NOT_FOUND" };
    }

    return { ok: false, code: "API_ERROR", retryable: true };
  }
}

/**
 * Fetches a single invoice by invoice number from Zoho Books.
 * Tries invoice_number first, then search_text with exact invoice_number match.
 */
export async function getZohoInvoiceByNumber(
  invoiceNumber: string,
): Promise<ZohoInvoiceLookupResult> {
  const normalized = normalizeInvoiceNumberForMatch(invoiceNumber);

  const byInvoiceNumber = await fetchZohoInvoiceListByQuery(
    { invoice_number: normalized },
    normalized,
    "invoice_number",
  );
  if (byInvoiceNumber.ok || byInvoiceNumber.code === "API_ERROR") {
    return byInvoiceNumber;
  }

  return fetchZohoInvoiceListByQuery(
    { search_text: normalized },
    normalized,
    "search_text",
  );
}

export function extractZohoInvoiceCustomerEmail(
  invoice: ZohoBooksInvoiceRecord,
): string | null {
  const candidates = [invoice.email, invoice.customer_email];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function buildSafeInvoiceFieldsFromZoho(invoice: ZohoBooksInvoiceRecord) {
  const balance = invoice.balance ?? invoice.total ?? 0;
  const amountDueCents = zohoAmountToCents(Math.max(0, balance));
  const paymentStatus = mapZohoInvoiceToPublicStatus({
    zohoStatus: invoice.status,
    balanceCents: amountDueCents,
    invoiceTotalCents: zohoAmountToCents(invoice.total),
  });

  return {
    invoiceNumber: invoice.invoice_number,
    customerName: invoice.customer_name?.trim() || null,
    amountDueCents,
    currency: invoice.currency_code?.trim() || "ZAR",
    dueDate: invoice.due_date?.trim() || null,
    lineItems: mapZohoInvoiceLineItems(invoice.line_items),
    paymentStatus:
      paymentStatus === "payable" || paymentStatus === "paid" || paymentStatus === "void"
        ? paymentStatus
        : ("error" as const),
  };
}
