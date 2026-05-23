import "server-only";

import type { CustomerBillingAccount, MonthlyInvoiceBatch, MonthlyInvoiceBatchItem } from "./monthlyBillingTypes";
import { resolveVisitDateFromInstant } from "./resolveBillingMonth";

function centsToZohoRate(amountCents: number): number {
  return Number((amountCents / 100).toFixed(2));
}

export type ZohoMonthlyInvoiceLineItemPayload = {
  name: string;
  description: string;
  rate: number;
  quantity: 1;
};

export type ZohoMonthlyInvoicePayload = {
  customer_id: string;
  reference_number: string;
  date: string;
  due_date?: string;
  currency_code: string;
  line_items: ZohoMonthlyInvoiceLineItemPayload[];
  terms: string;
};

export function buildMonthlyBatchZohoReferenceNumber(batchId: string): string {
  return `SHALEAN-MIB-${batchId}`;
}

export function formatMonthlyInvoiceServiceName(serviceSlug: string): string {
  const trimmed = serviceSlug.trim();
  if (!trimmed || trimmed === "unspecified") return "Cleaning service";
  return trimmed
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveInvoiceDateJohannesburg(isoInstant = new Date().toISOString()): string {
  return resolveVisitDateFromInstant(isoInstant) ?? new Date().toISOString().slice(0, 10);
}

export function resolveDueDateFromBillingTerms(
  billingTerms: string,
  invoiceDate: string,
): string | undefined {
  const match = billingTerms.match(/net\s*(\d+)/i);
  if (!match) return undefined;
  const days = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(days) || days <= 0) return undefined;
  const base = new Date(`${invoiceDate}T12:00:00.000Z`);
  if (Number.isNaN(base.getTime())) return undefined;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function buildZohoMonthlyInvoicePayload(input: {
  batch: MonthlyInvoiceBatch;
  billingAccount: CustomerBillingAccount;
  items: MonthlyInvoiceBatchItem[];
}): ZohoMonthlyInvoicePayload {
  if (!input.billingAccount.zohoCustomerId) {
    throw new Error("Billing account has no Zoho customer id.");
  }

  const invoiceDate = resolveInvoiceDateJohannesburg();
  const referenceNumber =
    input.batch.zohoReferenceNumber?.trim() ||
    buildMonthlyBatchZohoReferenceNumber(input.batch.id);

  const line_items = input.items.map((item) => {
    const serviceName = formatMonthlyInvoiceServiceName(item.serviceSlug);
    const bookingRef = item.bookingId.slice(0, 8);
    return {
      name: serviceName,
      description: `${serviceName} · Visit ${item.visitDate} · Booking ${bookingRef}`,
      rate: centsToZohoRate(item.amountCents),
      quantity: 1 as const,
    };
  });

  const dueDate = resolveDueDateFromBillingTerms(input.billingAccount.billingTerms, invoiceDate);

  return {
    customer_id: input.billingAccount.zohoCustomerId,
    reference_number: referenceNumber,
    date: invoiceDate,
    ...(dueDate ? { due_date: dueDate } : {}),
    currency_code: input.batch.currency,
    line_items,
    terms: input.billingAccount.billingTerms.trim() || "Net 30 — invoice at month end",
  };
}

export function sumBatchItemAmountCents(items: MonthlyInvoiceBatchItem[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}
