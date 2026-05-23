import { describe, expect, it, vi } from "vitest";
import { syncShaleanSaleToZoho } from "./syncShaleanSaleToZoho";

const findSyncMock = vi.fn();
const recordAttemptMock = vi.fn();
const loadSaleMock = vi.fn();
const markSyncedMock = vi.fn();
const markFailedMock = vi.fn();
const gateMock = vi.fn();

vi.mock("./zohoSalesSyncLaunchGuard", () => ({
  requireZohoSalesSyncEnabled: () => gateMock(),
}));

vi.mock("./zohoSalesSyncRepository", () => ({
  findZohoSalesSyncBySource: (...args: unknown[]) => findSyncMock(...args),
  recordZohoSalesSyncAttemptStart: (...args: unknown[]) => recordAttemptMock(...args),
  markZohoSalesSyncSynced: (...args: unknown[]) => markSyncedMock(...args),
  markZohoSalesSyncFailed: (...args: unknown[]) => markFailedMock(...args),
}));

vi.mock("./loadShaleanSaleSource", () => ({
  loadShaleanSaleSource: (...args: unknown[]) => loadSaleMock(...args),
}));

vi.mock("@/lib/zoho/customers", () => ({
  findOrCreateZohoCustomer: vi.fn(),
}));

vi.mock("@/lib/zoho/sales", () => ({
  createZohoBookingSalesInvoice: vi.fn(),
  recordZohoBookingCustomerPayment: vi.fn(),
}));

describe("syncShaleanSaleToZoho", () => {
  it("skips when already synced", async () => {
    gateMock.mockReturnValue({ ok: true });
    findSyncMock.mockResolvedValue({
      id: "sync-1",
      sync_status: "synced",
      sync_attempts: 0,
    });

    const result = await syncShaleanSaleToZoho("booking", "booking-1", {} as never);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.syncStatus).toBe("skipped");
  });

  it("marks existing Zoho invoice payment as synced when zoho_payment_id exists", async () => {
    gateMock.mockReturnValue({ ok: true });
    findSyncMock.mockResolvedValue({
      id: "sync-2",
      sync_status: "pending",
      sync_attempts: 0,
    });
    loadSaleMock.mockResolvedValue({
      sourceType: "zoho_invoice_payment",
      zohoInvoicePaymentId: "pay-1",
      invoiceNumber: "INV-001",
      zohoInvoiceId: "zoho-inv-1",
      zohoPaymentId: "zoho-pay-1",
      customerEmail: "jane@example.com",
      amountCents: 5000,
      currency: "ZAR",
      paystackReference: "ref-1",
      paymentDate: "2026-05-01T00:00:00.000Z",
    });
    markSyncedMock.mockResolvedValue({ id: "sync-2" });

    const result = await syncShaleanSaleToZoho("zoho_invoice_payment", "pay-1", {} as never);
    expect(result.ok).toBe(true);
    expect(markSyncedMock).toHaveBeenCalled();
  });

  it("does not create duplicate invoice for manual Zoho invoice rows without payment id", async () => {
    gateMock.mockReturnValue({ ok: true });
    findSyncMock.mockResolvedValue({
      id: "sync-3",
      sync_status: "pending",
      sync_attempts: 1,
    });
    loadSaleMock.mockResolvedValue({
      sourceType: "zoho_invoice_payment",
      zohoInvoicePaymentId: "pay-2",
      invoiceNumber: "INV-002",
      zohoInvoiceId: "zoho-inv-2",
      zohoPaymentId: null,
      customerEmail: "jane@example.com",
      amountCents: 5000,
      currency: "ZAR",
      paystackReference: "ref-2",
      paymentDate: null,
    });

    const { createZohoBookingSalesInvoice } = await import("@/lib/zoho/sales");
    const result = await syncShaleanSaleToZoho("zoho_invoice_payment", "pay-2", {} as never);

    expect(createZohoBookingSalesInvoice).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it("blocks when feature flag is off", async () => {
    gateMock.mockReturnValue({
      ok: false,
      code: "SALES_SYNC_DISABLED",
    });

    const result = await syncShaleanSaleToZoho("booking", "booking-1", {} as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SALES_SYNC_DISABLED");
  });
});
