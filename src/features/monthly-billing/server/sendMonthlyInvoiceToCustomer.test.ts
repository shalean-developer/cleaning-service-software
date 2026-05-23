import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendMonthlyInvoiceToCustomer } from "./sendMonthlyInvoiceToCustomer";

vi.mock("@/lib/app/zohoMonthlyInvoiceOperationsFlag", () => ({
  isZohoMonthlyInvoiceOperationsEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: vi.fn(() => ({})),
}));

vi.mock("./monthlyInvoiceOperationsRepository", () => ({
  loadBatchForOperations: vi.fn(),
  markBatchSentFromGenerated: vi.fn(),
  updateBatchOperationsMetadata: vi.fn(),
}));

vi.mock("./customerBillingAccountRepository", () => ({
  getCustomerBillingAccount: vi.fn(),
}));

vi.mock("./enqueueMonthlyInvoiceNotification", () => ({
  enqueueMonthlyInvoiceNotification: vi.fn(),
  resolveMonthlyInvoiceDueDate: vi.fn(() => "2026-06-30"),
  resolveMonthlyInvoicePaymentLink: vi.fn((invoiceNumber: string) => `/pay/${invoiceNumber}`),
}));

vi.mock("./recordCustomerBillingAccountAudit", () => ({
  recordCustomerBillingAccountAudit: vi.fn().mockResolvedValue(undefined),
}));

const loaded = {
  batch: {
    id: "batch-1",
    customerId: "cust-1",
    billingMonth: "2026-05",
    status: "generated",
    zohoInvoiceNumber: "INV-100",
    totalCents: 120000,
    currency: "ZAR",
    sentAt: null,
    metadata: {},
  },
  items: [{ id: "item-1", visitDate: "2026-05-10", serviceSlug: "standard-clean", amountCents: 120000 }],
};

describe("sendMonthlyInvoiceToCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks generated batch sent and enqueues email", async () => {
    const repo = await import("./monthlyInvoiceOperationsRepository");
    const accounts = await import("./customerBillingAccountRepository");
    const notify = await import("./enqueueMonthlyInvoiceNotification");
    const audit = await import("./recordCustomerBillingAccountAudit");

    vi.mocked(repo.loadBatchForOperations).mockResolvedValueOnce(loaded as never);
    vi.mocked(accounts.getCustomerBillingAccount).mockResolvedValueOnce({
      id: "acc-1",
      billingEmail: "billing@example.com",
      billingTerms: "Net 30",
    } as never);
    vi.mocked(notify.enqueueMonthlyInvoiceNotification).mockResolvedValueOnce("outbox-1");
    vi.mocked(repo.markBatchSentFromGenerated).mockResolvedValueOnce({
      ...loaded.batch,
      status: "sent",
      sentAt: "2026-05-23T12:00:00.000Z",
    } as never);
    vi.mocked(repo.updateBatchOperationsMetadata).mockResolvedValueOnce({
      ...loaded.batch,
      status: "sent",
    } as never);

    const result = await sendMonthlyInvoiceToCustomer({
      batchId: "batch-1",
      adminProfileId: "admin-1",
      idempotencyKey: "send-key-12345678",
      client: {} as never,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.send.currentStatus).toBe("sent");
      expect(result.send.paymentLink).toBe("/pay/INV-100");
      expect(result.idempotent).toBe(false);
    }
    expect(notify.enqueueMonthlyInvoiceNotification).toHaveBeenCalled();
    expect(audit.recordCustomerBillingAccountAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "monthly_invoice_sent" }),
    );
  });

  it("does not send for paid batches", async () => {
    const repo = await import("./monthlyInvoiceOperationsRepository");
    vi.mocked(repo.loadBatchForOperations).mockResolvedValueOnce({
      batch: { ...loaded.batch, status: "paid" },
      items: [],
    } as never);

    const result = await sendMonthlyInvoiceToCustomer({
      batchId: "batch-1",
      adminProfileId: "admin-1",
      idempotencyKey: "send-key-12345678",
      client: {} as never,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_STATUS");
  });
});
