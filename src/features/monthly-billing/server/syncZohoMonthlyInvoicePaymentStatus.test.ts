import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncZohoMonthlyInvoicePaymentStatus } from "./syncZohoMonthlyInvoicePaymentStatus";

vi.mock("@/lib/app/zohoMonthlyInvoicePaymentSyncFlag", () => ({
  isZohoMonthlyInvoicePaymentSyncEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/zoho/invoices", () => ({
  getZohoInvoiceById: vi.fn(),
  getZohoInvoiceByNumber: vi.fn(),
  zohoAmountToCents: vi.fn((amount: number) => Math.round(amount * 100)),
}));

vi.mock("./monthlyInvoicePaymentSyncRepository", () => ({
  loadBatchForPaymentSync: vi.fn(),
  findPaidShaleanZohoInvoicePayment: vi.fn(),
  markBatchPaid: vi.fn(),
  markBatchOverdue: vi.fn(),
  markBatchSent: vi.fn(),
  markBatchVoid: vi.fn(),
  markItemsPaid: vi.fn(),
  markBatchPaymentSyncFailed: vi.fn(),
  recordBatchPaymentSyncCheck: vi.fn(),
  isSyncableBatchPaymentStatus: vi.fn(() => true),
  isTerminalBatchPaymentStatus: vi.fn(() => false),
}));

vi.mock("./customerBillingAccountRepository", () => ({
  getCustomerBillingAccount: vi.fn().mockResolvedValue({ id: "acc-1" }),
}));

vi.mock("./recordCustomerBillingAccountAudit", () => ({
  recordCustomerBillingAccountAudit: vi.fn().mockResolvedValue(undefined),
}));

const loaded = {
  batch: {
    id: "batch-1",
    customerId: "cust-1",
    status: "generated",
    zohoInvoiceId: "zoho-inv-1",
    zohoInvoiceNumber: "INV-001",
    paidAt: null,
    sentAt: null,
    metadata: {},
  },
  items: [{ id: "item-1", status: "invoiced" }],
};

describe("syncZohoMonthlyInvoicePaymentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks batch paid from Shalean zoho_invoice_payments row", async () => {
    const repo = await import("./monthlyInvoicePaymentSyncRepository");
    vi.mocked(repo.loadBatchForPaymentSync).mockResolvedValueOnce(loaded as never);
    vi.mocked(repo.findPaidShaleanZohoInvoicePayment).mockResolvedValueOnce({
      id: "pay-1",
      paid_at: "2026-05-23T12:00:00.000Z",
      invoice_number: "INV-001",
      zoho_invoice_id: "zoho-inv-1",
    });
    vi.mocked(repo.markBatchPaid).mockResolvedValueOnce({
      ...loaded.batch,
      status: "paid",
      paidAt: "2026-05-23T12:00:00.000Z",
    } as never);
    vi.mocked(repo.markItemsPaid).mockResolvedValueOnce(1);
    vi.mocked(repo.recordBatchPaymentSyncCheck).mockImplementation(async (_c, batch) => batch as never);

    const result = await syncZohoMonthlyInvoicePaymentStatus({
      batchId: "batch-1",
      source: "manual",
      client: {} as never,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.outcome !== "skipped") {
      expect(result.sync.currentStatus).toBe("paid");
      expect(result.sync.source).toBe("shalean_pay_page");
    }
    expect(repo.markBatchPaid).toHaveBeenCalled();
    expect(repo.markItemsPaid).toHaveBeenCalled();
  });

  it("marks batch paid from external Zoho invoice status", async () => {
    const repo = await import("./monthlyInvoicePaymentSyncRepository");
    const zoho = await import("@/lib/zoho/invoices");
    vi.mocked(repo.loadBatchForPaymentSync).mockResolvedValueOnce(loaded as never);
    vi.mocked(repo.findPaidShaleanZohoInvoicePayment).mockResolvedValueOnce(null);
    vi.mocked(zoho.getZohoInvoiceById).mockResolvedValueOnce({
      ok: true,
      invoice: { invoice_id: "zoho-inv-1", invoice_number: "INV-001", status: "paid", balance: 0 },
    } as never);
    vi.mocked(repo.markBatchPaid).mockResolvedValueOnce({
      ...loaded.batch,
      status: "paid",
      paidAt: "2026-05-23T12:00:00.000Z",
    } as never);
    vi.mocked(repo.markItemsPaid).mockResolvedValueOnce(1);
    vi.mocked(repo.recordBatchPaymentSyncCheck).mockImplementation(async (_c, batch) => batch as never);

    const result = await syncZohoMonthlyInvoicePaymentStatus({
      batchId: "batch-1",
      source: "cron",
      client: {} as never,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.outcome !== "skipped") {
      expect(result.sync.currentStatus).toBe("paid");
    }
  });

  it("records failure when Zoho is unavailable and keeps current status", async () => {
    const repo = await import("./monthlyInvoicePaymentSyncRepository");
    const zoho = await import("@/lib/zoho/invoices");
    vi.mocked(repo.loadBatchForPaymentSync).mockResolvedValueOnce(loaded as never);
    vi.mocked(repo.findPaidShaleanZohoInvoicePayment).mockResolvedValueOnce(null);
    vi.mocked(zoho.getZohoInvoiceById).mockResolvedValueOnce({ ok: false, code: "API_ERROR", retryable: true });
    vi.mocked(repo.markBatchPaymentSyncFailed).mockResolvedValueOnce(loaded.batch as never);

    const result = await syncZohoMonthlyInvoicePaymentStatus({
      batchId: "batch-1",
      source: "manual",
      client: {} as never,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ZOHO_UNAVAILABLE");
    expect(repo.markBatchPaymentSyncFailed).toHaveBeenCalled();
    expect(repo.markBatchPaid).not.toHaveBeenCalled();
  });

  it("returns terminal state without mutating paid batches", async () => {
    const repo = await import("./monthlyInvoicePaymentSyncRepository");
    vi.mocked(repo.isTerminalBatchPaymentStatus).mockReturnValueOnce(true);
    vi.mocked(repo.loadBatchForPaymentSync).mockResolvedValueOnce({
      ...loaded,
      batch: { ...loaded.batch, status: "paid", paidAt: "2026-05-23T12:00:00.000Z" },
    } as never);
    vi.mocked(repo.recordBatchPaymentSyncCheck).mockImplementation(async (_c, batch) => batch as never);

    const result = await syncZohoMonthlyInvoicePaymentStatus({
      batchId: "batch-1",
      source: "manual",
      client: {} as never,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.outcome).toBe("terminal");
    expect(repo.markBatchPaid).not.toHaveBeenCalled();
  });
});
