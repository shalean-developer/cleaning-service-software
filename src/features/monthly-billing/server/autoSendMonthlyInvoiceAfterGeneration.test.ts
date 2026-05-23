import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoSendMonthlyInvoiceAfterGeneration } from "./autoSendMonthlyInvoiceAfterGeneration";

vi.mock("@/lib/app/zohoMonthlyInvoiceAutomationFlag", () => ({
  isZohoMonthlyInvoiceAutomationEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/app/zohoMonthlyInvoiceOperationsFlag", () => ({
  isZohoMonthlyInvoiceOperationsEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: vi.fn(() => ({})),
}));

vi.mock("./monthlyInvoiceBatchRepository", () => ({
  getMonthlyInvoiceBatch: vi.fn(),
}));

vi.mock("./customerBillingAccountRepository", () => ({
  getCustomerBillingAccount: vi.fn(),
}));

vi.mock("./sendMonthlyInvoiceToCustomer", () => ({
  sendMonthlyInvoiceToCustomer: vi.fn(),
}));

vi.mock("./recordCustomerBillingAccountAudit", () => ({
  recordCustomerBillingAccountAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./monthlyInvoiceDeliveryRepository", () => ({
  recordBatchDeliveryFailure: vi.fn().mockResolvedValue(undefined),
}));

const batch = {
  id: "batch-1",
  customerId: "cust-1",
  status: "generated",
  sentAt: null,
  metadata: { delivery: { autoSendEnabled: true } },
  zohoInvoiceNumber: "INV-100",
};

describe("autoSendMonthlyInvoiceAfterGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-sends generated invoice when enabled", async () => {
    const batches = await import("./monthlyInvoiceBatchRepository");
    const accounts = await import("./customerBillingAccountRepository");
    const send = await import("./sendMonthlyInvoiceToCustomer");

    vi.mocked(batches.getMonthlyInvoiceBatch).mockResolvedValue(batch as never);
    vi.mocked(accounts.getCustomerBillingAccount).mockResolvedValue({
      id: "acc-1",
      billingEmail: "billing@example.com",
    } as never);
    vi.mocked(send.sendMonthlyInvoiceToCustomer).mockResolvedValueOnce({
      ok: true,
      idempotent: false,
      send: {
        batchId: "batch-1",
        previousStatus: "generated",
        currentStatus: "sent",
        sentAt: "2026-05-23T12:00:00.000Z",
        paymentLink: "/pay/INV-100",
        notificationOutboxId: "outbox-1",
      },
    });

    const result = await autoSendMonthlyInvoiceAfterGeneration({
      batchId: "batch-1",
      client: {} as never,
    });

    expect(result).toEqual({ ok: true, skipped: false, sent: true });
    expect(send.sendMonthlyInvoiceToCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ source: "auto", batchId: "batch-1" }),
    );
  });

  it("skips duplicate auto-send when already sent", async () => {
    const batches = await import("./monthlyInvoiceBatchRepository");
    const send = await import("./sendMonthlyInvoiceToCustomer");

    vi.mocked(batches.getMonthlyInvoiceBatch).mockResolvedValue({
      ...batch,
      status: "generated",
      sentAt: "2026-05-22T12:00:00.000Z",
    } as never);
    vi.mocked(send.sendMonthlyInvoiceToCustomer).mockResolvedValueOnce({
      ok: false,
      code: "INVALID_STATUS",
      message: "Already sent",
    });

    const result = await autoSendMonthlyInvoiceAfterGeneration({
      batchId: "batch-1",
      client: {} as never,
    });

    expect(result).toEqual({ ok: true, skipped: true, reason: "ALREADY_SENT" });
  });

  it("handles missing billing email safely", async () => {
    const batches = await import("./monthlyInvoiceBatchRepository");
    const accounts = await import("./customerBillingAccountRepository");
    const send = await import("./sendMonthlyInvoiceToCustomer");

    vi.mocked(batches.getMonthlyInvoiceBatch).mockResolvedValue(batch as never);
    vi.mocked(accounts.getCustomerBillingAccount).mockResolvedValue({
      id: "acc-1",
      billingEmail: "",
    } as never);

    const result = await autoSendMonthlyInvoiceAfterGeneration({
      batchId: "batch-1",
      client: {} as never,
    });

    expect(result).toEqual({ ok: true, skipped: true, reason: "MISSING_BILLING_EMAIL" });
    expect(send.sendMonthlyInvoiceToCustomer).not.toHaveBeenCalled();
  });
});
