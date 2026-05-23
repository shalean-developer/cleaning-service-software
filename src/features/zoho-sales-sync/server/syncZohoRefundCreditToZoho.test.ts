import { describe, expect, it, vi } from "vitest";
import { syncZohoRefundCreditToZoho } from "./syncZohoRefundCreditToZoho";

const gateMock = vi.fn();
const findMock = vi.fn();
const recordAttemptMock = vi.fn();
const markFailedMock = vi.fn();
const markSyncedMock = vi.fn();
const contextMock = vi.fn();
const createCreditNoteMock = vi.fn();

vi.mock("./zohoRefundCreditSyncLaunchGuard", () => ({
  requireZohoRefundCreditSyncEnabled: () => gateMock(),
}));

vi.mock("./zohoRefundCreditSyncRepository", () => ({
  findZohoRefundCreditSyncBySource: (...args: unknown[]) => findMock(...args),
  recordZohoRefundCreditSyncAttemptStart: (...args: unknown[]) => recordAttemptMock(...args),
  markZohoRefundCreditFailed: (...args: unknown[]) => markFailedMock(...args),
  markZohoRefundCreditSynced: (...args: unknown[]) => markSyncedMock(...args),
}));

vi.mock("./loadRefundCreditSource", () => ({
  loadRefundCreditSourceContext: (...args: unknown[]) => contextMock(...args),
}));

vi.mock("@/lib/zoho/invoices", () => ({
  getZohoInvoiceById: vi.fn(async () => ({
    ok: true,
    invoice: { customer_id: "cust-1" },
  })),
}));

vi.mock("@/lib/zoho/creditNotes", () => ({
  createZohoCreditNoteForInvoice: (...args: unknown[]) => createCreditNoteMock(...args),
  applyZohoCreditNoteToInvoice: vi.fn(async () => ({ ok: true })),
  recordZohoRefundForCreditNote: vi.fn(async () => ({ ok: true, zohoRefundId: null })),
}));

vi.mock("@/lib/zoho/zohoRefundCreditLogger", () => ({
  logZohoRefundCreditEvent: vi.fn(),
}));

describe("syncZohoRefundCreditToZoho", () => {
  it("marks synced on successful credit note creation", async () => {
    gateMock.mockReturnValue({ ok: true });
    findMock.mockResolvedValue({
      id: "sync-1",
      sync_status: "pending",
      sync_attempts: 0,
      amount_cents: 5000,
      currency: "ZAR",
      reason: "Refund",
      zoho_credit_note_id: null,
      zoho_refund_id: null,
    });
    contextMock.mockResolvedValue({
      zohoInvoiceId: "inv-1",
      invoiceNumber: "INV-001",
      customerId: "cust-1",
      paystackReference: "pay-ref",
      lineItemName: "Refund",
    });
    createCreditNoteMock.mockResolvedValue({
      ok: true,
      zohoCreditNoteId: "cn-1",
      zohoStatus: "open",
    });

    const result = await syncZohoRefundCreditToZoho("booking_refund", "source-1", {} as never);

    expect(result.ok).toBe(true);
    expect(markSyncedMock).toHaveBeenCalled();
  });

  it("schedules retry when Zoho API fails", async () => {
    gateMock.mockReturnValue({ ok: true });
    findMock.mockResolvedValue({
      id: "sync-1",
      sync_status: "pending",
      sync_attempts: 0,
      amount_cents: 5000,
      currency: "ZAR",
      reason: "Refund",
      zoho_credit_note_id: null,
      zoho_refund_id: null,
    });
    contextMock.mockResolvedValue({
      zohoInvoiceId: "inv-1",
      invoiceNumber: "INV-001",
      customerId: "cust-1",
      paystackReference: null,
      lineItemName: "Refund",
    });
    createCreditNoteMock.mockResolvedValue({
      ok: false,
      code: "ZOHO_CREDIT_NOTE_CREATE_FAILED",
      retryable: true,
    });

    const result = await syncZohoRefundCreditToZoho("booking_refund", "source-1", {} as never);

    expect(result.ok).toBe(false);
    expect(markFailedMock).toHaveBeenCalledWith(
      "sync-1",
      expect.any(String),
      1,
      expect.anything(),
    );
  });
});
