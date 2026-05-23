import { describe, expect, it } from "vitest";
import {
  buildMonthlyBatchZohoReferenceNumber,
  buildZohoMonthlyInvoicePayload,
  formatMonthlyInvoiceServiceName,
  resolveDueDateFromBillingTerms,
  sumBatchItemAmountCents,
} from "./buildZohoMonthlyInvoicePayload";
import type { CustomerBillingAccount, MonthlyInvoiceBatch, MonthlyInvoiceBatchItem } from "./monthlyBillingTypes";

const batch: MonthlyInvoiceBatch = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  customerId: "11111111-1111-4111-8111-111111111111",
  billingMonth: "2026-05-01",
  status: "draft",
  zohoInvoiceId: null,
  zohoInvoiceNumber: null,
  totalCents: 300000,
  currency: "ZAR",
  generatedByAdminId: null,
  generatedAt: null,
  sentAt: null,
  paidAt: null,
  idempotencyKey: "batch:key",
  zohoReferenceNumber: null,
  metadata: {},
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const billingAccount: CustomerBillingAccount = {
  id: "acc-1",
  customerId: batch.customerId,
  billingMode: "monthly_account",
  zohoCustomerId: "zoho-cust-123",
  billingEmail: "billing@example.com",
  billingTerms: "Net 30 — invoice at month end",
  isMonthlyAccountEnabled: true,
  approvedByAdminId: "admin-1",
  approvedAt: "2026-01-01T00:00:00.000Z",
  approvalReason: "Approved",
  disabledAt: null,
  disabledByAdminId: null,
  metadata: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const items: MonthlyInvoiceBatchItem[] = [
  {
    id: "item-1",
    batchId: batch.id,
    bookingId: "22222222-2222-4222-8222-222222222222",
    visitDate: "2026-05-10",
    serviceSlug: "standard-clean",
    amountCents: 150000,
    status: "accrued",
    zohoLineItemId: null,
    metadata: {},
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
  },
  {
    id: "item-2",
    batchId: batch.id,
    bookingId: "33333333-3333-4333-8333-333333333333",
    visitDate: "2026-05-20",
    serviceSlug: "deep-clean",
    amountCents: 150000,
    status: "accrued",
    zohoLineItemId: null,
    metadata: {},
    createdAt: "2026-05-20T00:00:00.000Z",
    updatedAt: "2026-05-20T00:00:00.000Z",
  },
];

describe("buildZohoMonthlyInvoicePayload", () => {
  it("builds reference number from batch id", () => {
    expect(buildMonthlyBatchZohoReferenceNumber(batch.id)).toBe(
      `SHALEAN-MIB-${batch.id}`,
    );
  });

  it("builds payload with Zoho customer and line items", () => {
    const payload = buildZohoMonthlyInvoicePayload({ batch, billingAccount, items });

    expect(payload.customer_id).toBe("zoho-cust-123");
    expect(payload.reference_number).toBe(`SHALEAN-MIB-${batch.id}`);
    expect(payload.currency_code).toBe("ZAR");
    expect(payload.line_items).toHaveLength(2);
    expect(payload.line_items[0]?.rate).toBe(1500);
    expect(payload.line_items[0]?.description).toContain("2026-05-10");
    expect(payload.line_items[0]?.description).toContain("22222222");
    expect(payload.terms).toContain("Net 30");
    expect(payload).not.toHaveProperty("notes");
  });

  it("matches batch total in line item rates", () => {
    const payload = buildZohoMonthlyInvoicePayload({ batch, billingAccount, items });
    const total = payload.line_items.reduce((sum, line) => sum + line.rate * line.quantity, 0);
    expect(total).toBe(sumBatchItemAmountCents(items) / 100);
  });

  it("formats service slug as readable name", () => {
    expect(formatMonthlyInvoiceServiceName("standard-clean")).toBe("Standard Clean");
  });

  it("derives due date from Net terms", () => {
    expect(resolveDueDateFromBillingTerms("Net 30", "2026-05-01")).toBe("2026-05-31");
  });
});
