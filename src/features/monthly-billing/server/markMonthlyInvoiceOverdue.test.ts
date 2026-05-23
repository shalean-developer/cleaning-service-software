import { beforeEach, describe, expect, it, vi } from "vitest";
import { markMonthlyInvoiceOverdue } from "./markMonthlyInvoiceOverdue";

vi.mock("@/lib/app/zohoMonthlyInvoiceOperationsFlag", () => ({
  isZohoMonthlyInvoiceOperationsEnabled: vi.fn(() => true),
}));

vi.mock("./monthlyInvoiceOperationsRepository", () => ({
  loadBatchForOperations: vi.fn(),
  markBatchOverdueForOperations: vi.fn(),
}));

vi.mock("./customerBillingAccountRepository", () => ({
  getCustomerBillingAccount: vi.fn(),
}));

vi.mock("./enqueueMonthlyInvoiceNotification", () => ({
  resolveMonthlyInvoiceDueDate: vi.fn(() => "2026-05-01"),
}));

vi.mock("./recordCustomerBillingAccountAudit", () => ({
  recordCustomerBillingAccountAudit: vi.fn().mockResolvedValue(undefined),
}));

describe("markMonthlyInvoiceOverdue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks sent batch overdue when past due", async () => {
    const repo = await import("./monthlyInvoiceOperationsRepository");
    const accounts = await import("./customerBillingAccountRepository");

    vi.mocked(repo.loadBatchForOperations).mockResolvedValueOnce({
      batch: { id: "batch-1", customerId: "cust-1", status: "sent", metadata: {} },
      items: [],
    } as never);
    vi.mocked(accounts.getCustomerBillingAccount).mockResolvedValueOnce({
      id: "acc-1",
      billingTerms: "Net 30",
    } as never);
    vi.mocked(repo.markBatchOverdueForOperations).mockResolvedValueOnce({
      id: "batch-1",
      status: "overdue",
    } as never);

    const result = await markMonthlyInvoiceOverdue({
      batchId: "batch-1",
      adminProfileId: "admin-1",
      idempotencyKey: "overdue-key-12345678",
      client: {} as never,
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.overdue.currentStatus).toBe("overdue");
  });

  it("blocks when not past due", async () => {
    const repo = await import("./monthlyInvoiceOperationsRepository");
    const accounts = await import("./customerBillingAccountRepository");
    const due = await import("./enqueueMonthlyInvoiceNotification");

    vi.mocked(repo.loadBatchForOperations).mockResolvedValueOnce({
      batch: { id: "batch-1", customerId: "cust-1", status: "sent", metadata: {} },
      items: [],
    } as never);
    vi.mocked(accounts.getCustomerBillingAccount).mockResolvedValueOnce({
      id: "acc-1",
      billingTerms: "Net 30",
    } as never);
    vi.mocked(due.resolveMonthlyInvoiceDueDate).mockReturnValueOnce("2099-12-31");

    const result = await markMonthlyInvoiceOverdue({
      batchId: "batch-1",
      adminProfileId: "admin-1",
      idempotencyKey: "overdue-key-12345678",
      client: {} as never,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_PAST_DUE");
  });

  it("blocks paid batches", async () => {
    const repo = await import("./monthlyInvoiceOperationsRepository");
    vi.mocked(repo.loadBatchForOperations).mockResolvedValueOnce({
      batch: { id: "batch-1", status: "paid", metadata: {} },
      items: [],
    } as never);

    const result = await markMonthlyInvoiceOverdue({
      batchId: "batch-1",
      adminProfileId: "admin-1",
      idempotencyKey: "overdue-key-12345678",
      client: {} as never,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_STATUS");
  });
});
