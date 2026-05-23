import { describe, expect, it, vi } from "vitest";
import { checkZohoInvoiceForAdmin } from "./checkZohoInvoiceForAdmin";

const fetchDetailsMock = vi.fn();
const logEventMock = vi.fn();

vi.mock("./fetchZohoInvoicePaymentDetails", () => ({
  fetchZohoInvoicePaymentDetails: (...args: unknown[]) => fetchDetailsMock(...args),
}));

vi.mock("@/lib/zoho/zohoInvoicePaymentLogger", () => ({
  logZohoInvoicePaymentEvent: (...args: unknown[]) => logEventMock(...args),
}));

describe("checkZohoInvoiceForAdmin", () => {
  it("returns safe admin summary for payable invoice", async () => {
    fetchDetailsMock.mockResolvedValue({
      ok: true,
      invoice: {
        invoiceNumber: "INV-001602",
        customerName: "Jane Doe",
        amountDueCents: 10_000,
        currency: "ZAR",
        dueDate: "2026-06-01",
        status: "payable",
      },
    });

    const result = await checkZohoInvoiceForAdmin("inv-001602");

    expect(result).toMatchObject({
      ok: true,
      invoiceNumber: "INV-001602",
      customerName: "Jane Doe",
      amountDueCents: 10_000,
      currency: "ZAR",
      dueDate: "2026-06-01",
      status: "payable",
      canPayNow: true,
    });
    if (result.ok) {
      expect(result.amountDueDisplay).toContain("100");
    }
    expect(logEventMock).toHaveBeenCalledWith("zoho_invoice_admin_invoice_checked", {
      invoiceNumber: "INV-001602",
      publicStatus: "payable",
      balanceCents: 10_000,
    });
  });

  it("does not expose raw Zoho payload on failure", async () => {
    fetchDetailsMock.mockResolvedValue({
      ok: false,
      status: "not_configured",
      message: "Online invoice payments are not available yet.",
      invoiceNumber: "INV-001602",
    });

    const result = await checkZohoInvoiceForAdmin("INV-001602");

    expect(result).toEqual({
      ok: false,
      code: "NOT_CONFIGURED",
      message: "Online invoice payments are not available yet.",
      invoiceNumber: "INV-001602",
    });
    expect(logEventMock).toHaveBeenCalledWith("zoho_invoice_admin_invoice_check_failed", {
      invoiceNumber: "INV-001602",
      failureCode: "NOT_CONFIGURED",
      publicStatus: "not_configured",
    });
  });
});
