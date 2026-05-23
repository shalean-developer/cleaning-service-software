import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendMonthlyInvoiceReminder } from "./sendMonthlyInvoiceReminder";

vi.mock("@/lib/app/zohoMonthlyInvoiceOperationsFlag", () => ({
  isZohoMonthlyInvoiceOperationsEnabled: vi.fn(() => true),
}));

vi.mock("./monthlyInvoiceOperationsRepository", () => ({
  loadBatchForOperations: vi.fn(),
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

describe("sendMonthlyInvoiceReminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments reminder count for sent batches", async () => {
    const repo = await import("./monthlyInvoiceOperationsRepository");
    const accounts = await import("./customerBillingAccountRepository");
    const notify = await import("./enqueueMonthlyInvoiceNotification");

    vi.mocked(repo.loadBatchForOperations).mockResolvedValueOnce({
      batch: {
        id: "batch-1",
        customerId: "cust-1",
        status: "sent",
        zohoInvoiceNumber: "INV-100",
        billingMonth: "2026-05",
        totalCents: 10000,
        currency: "ZAR",
        metadata: { invoiceOperations: { reminderCount: 1, paymentLink: "/pay/INV-100" } },
      },
      items: [],
    } as never);
    vi.mocked(accounts.getCustomerBillingAccount).mockResolvedValueOnce({
      id: "acc-1",
      billingEmail: "billing@example.com",
      billingTerms: "Net 30",
    } as never);
    vi.mocked(notify.enqueueMonthlyInvoiceNotification).mockResolvedValueOnce("outbox-2");
    vi.mocked(repo.updateBatchOperationsMetadata).mockResolvedValueOnce({} as never);

    const result = await sendMonthlyInvoiceReminder({
      batchId: "batch-1",
      adminProfileId: "admin-1",
      idempotencyKey: "reminder-key-12345678",
      client: {} as never,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.reminder.reminderCount).toBe(2);
  });

  it("blocks paid batches", async () => {
    const repo = await import("./monthlyInvoiceOperationsRepository");
    vi.mocked(repo.loadBatchForOperations).mockResolvedValueOnce({
      batch: { id: "batch-1", status: "paid", metadata: {} },
      items: [],
    } as never);

    const result = await sendMonthlyInvoiceReminder({
      batchId: "batch-1",
      adminProfileId: "admin-1",
      idempotencyKey: "reminder-key-12345678",
      client: {} as never,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_STATUS");
  });
});
