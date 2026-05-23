import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateZohoMonthlyInvoice } from "./generateZohoMonthlyInvoiceFacade";

vi.mock("@/lib/app/zohoMonthlyInvoiceGenerationFlag", () => ({
  isZohoMonthlyInvoiceGenerationEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: vi.fn(() => ({})),
}));

vi.mock("./monthlyInvoiceGenerationIdempotency", () => ({
  findMonthlyInvoiceGenerationIdempotency: vi.fn(),
  storeMonthlyInvoiceGenerationIdempotency: vi.fn().mockResolvedValue(undefined),
  buildGenerationIdempotencyStoredResult: vi.fn((input: unknown) => input),
}));

vi.mock("./monthlyInvoiceGenerationRepository", () => ({
  assertBatchReadyForGeneration: vi.fn(),
  filterGeneratableBatchItems: vi.fn((items: Array<{ status: string }>) =>
    items.filter((item) => item.status === "accrued"),
  ),
  getExistingGeneratedInvoice: vi.fn(),
  loadBatchForGeneration: vi.fn(),
  markBatchGenerated: vi.fn(),
  updateBatchItemsInvoiced: vi.fn(),
  MonthlyInvoiceBatchGenerationError: class MonthlyInvoiceBatchGenerationError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

vi.mock("./buildZohoMonthlyInvoicePayload", () => ({
  buildZohoMonthlyInvoicePayload: vi.fn(() => ({
    customer_id: "zoho-cust-123",
    reference_number: "SHALEAN-MIB-batch-1",
    date: "2026-05-23",
    currency_code: "ZAR",
    line_items: [{ name: "Clean", description: "Visit", rate: 1500, quantity: 1 }],
    terms: "Net 30",
  })),
}));

vi.mock("@/lib/zoho/monthlyInvoices", () => ({
  createZohoMonthlyInvoice: vi.fn(),
}));

vi.mock("./recordCustomerBillingAccountAudit", () => ({
  recordCustomerBillingAccountAudit: vi.fn().mockResolvedValue(undefined),
}));

const admin = {
  authUser: {} as never,
  profileId: "admin-profile-1",
  role: "admin" as const,
};

const loaded = {
  batch: {
    id: "batch-1",
    customerId: "cust-1",
    totalCents: 150000,
    status: "draft",
    currency: "ZAR",
  },
  billingAccount: {
    id: "acc-1",
    zohoCustomerId: "zoho-cust-123",
    isMonthlyAccountEnabled: true,
  },
  items: [
    {
      id: "item-1",
      bookingId: "booking-1",
      status: "accrued",
      amountCents: 150000,
      serviceSlug: "standard-clean",
      visitDate: "2026-05-10",
    },
  ],
};

describe("generateZohoMonthlyInvoice facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects when feature flag is off", async () => {
    const { isZohoMonthlyInvoiceGenerationEnabled } = await import(
      "@/lib/app/zohoMonthlyInvoiceGenerationFlag"
    );
    vi.mocked(isZohoMonthlyInvoiceGenerationEnabled).mockReturnValueOnce(false);

    const result = await generateZohoMonthlyInvoice({
      admin,
      batchId: "batch-1",
      idempotencyKey: "generate-key-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("FEATURE_DISABLED");
  });

  it("returns idempotent stored result", async () => {
    const { findMonthlyInvoiceGenerationIdempotency } = await import(
      "./monthlyInvoiceGenerationIdempotency"
    );
    vi.mocked(findMonthlyInvoiceGenerationIdempotency).mockResolvedValueOnce({
      action: "monthly_invoice_generated",
      batchId: "batch-1",
      customerId: "cust-1",
      zohoInvoiceId: "inv-1",
      zohoInvoiceNumber: "INV-001",
      status: "generated",
      totalCents: 150000,
      itemCount: 1,
      idempotent: true,
    });

    const result = await generateZohoMonthlyInvoice({
      admin,
      batchId: "batch-1",
      idempotencyKey: "generate-key-2",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.idempotent).toBe(true);
      expect(result.invoice.zohoInvoiceId).toBe("inv-1");
    }
  });

  it("generates invoice for draft batch", async () => {
    const { findMonthlyInvoiceGenerationIdempotency } = await import(
      "./monthlyInvoiceGenerationIdempotency"
    );
    const { getExistingGeneratedInvoice, loadBatchForGeneration, markBatchGenerated } =
      await import("./monthlyInvoiceGenerationRepository");
    const { createZohoMonthlyInvoice } = await import("@/lib/zoho/monthlyInvoices");

    vi.mocked(findMonthlyInvoiceGenerationIdempotency).mockResolvedValueOnce(null);
    vi.mocked(getExistingGeneratedInvoice).mockResolvedValueOnce(null);
    vi.mocked(loadBatchForGeneration).mockResolvedValueOnce(loaded as never);
    vi.mocked(createZohoMonthlyInvoice).mockResolvedValueOnce({
      ok: true,
      invoiceId: "inv-new",
      invoiceNumber: "INV-100",
      referenceNumber: "SHALEAN-MIB-batch-1",
      lineItems: [{ batchItemId: "item-1", zohoLineItemId: "line-1" }],
    });
    vi.mocked(markBatchGenerated).mockResolvedValueOnce({
      ...loaded.batch,
      status: "generated",
      zohoInvoiceId: "inv-new",
    } as never);

    const result = await generateZohoMonthlyInvoice({
      admin,
      batchId: "batch-1",
      idempotencyKey: "generate-key-3",
    });

    expect(result.ok).toBe(true);
    expect(createZohoMonthlyInvoice).toHaveBeenCalledTimes(1);
    expect(markBatchGenerated).toHaveBeenCalled();
  });

  it("returns existing invoice without calling Zoho", async () => {
    const { findMonthlyInvoiceGenerationIdempotency } = await import(
      "./monthlyInvoiceGenerationIdempotency"
    );
    const { getExistingGeneratedInvoice } = await import("./monthlyInvoiceGenerationRepository");
    const { createZohoMonthlyInvoice } = await import("@/lib/zoho/monthlyInvoices");

    vi.mocked(findMonthlyInvoiceGenerationIdempotency).mockResolvedValueOnce(null);
    vi.mocked(getExistingGeneratedInvoice).mockResolvedValueOnce({
      batchId: "batch-1",
      zohoInvoiceId: "inv-existing",
      zohoInvoiceNumber: "INV-EXIST",
      status: "generated",
      totalCents: 150000,
      itemCount: 1,
    });

    const result = await generateZohoMonthlyInvoice({
      admin,
      batchId: "batch-1",
      idempotencyKey: "generate-key-4",
    });

    expect(result.ok).toBe(true);
    expect(createZohoMonthlyInvoice).not.toHaveBeenCalled();
  });

  it("leaves batch draft when Zoho fails", async () => {
    const { findMonthlyInvoiceGenerationIdempotency } = await import(
      "./monthlyInvoiceGenerationIdempotency"
    );
    const { getExistingGeneratedInvoice, loadBatchForGeneration, markBatchGenerated } =
      await import("./monthlyInvoiceGenerationRepository");
    const { createZohoMonthlyInvoice } = await import("@/lib/zoho/monthlyInvoices");

    vi.mocked(findMonthlyInvoiceGenerationIdempotency).mockResolvedValueOnce(null);
    vi.mocked(getExistingGeneratedInvoice).mockResolvedValueOnce(null);
    vi.mocked(loadBatchForGeneration).mockResolvedValueOnce(loaded as never);
    vi.mocked(createZohoMonthlyInvoice).mockResolvedValueOnce({
      ok: false,
      code: "ZOHO_INVOICE_CREATE_FAILED",
      retryable: true,
      message: "Zoho unavailable",
    });

    const result = await generateZohoMonthlyInvoice({
      admin,
      batchId: "batch-1",
      idempotencyKey: "generate-key-5",
    });

    expect(result.ok).toBe(false);
    expect(markBatchGenerated).not.toHaveBeenCalled();
  });
});
