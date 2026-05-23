import { describe, expect, it, vi } from "vitest";
import { generateZohoInvoiceAdminPaymentLink } from "./generateZohoInvoiceAdminPaymentLink";

const resolveBaseUrlMock = vi.fn();
const logEventMock = vi.fn();

vi.mock("@/lib/app/appBaseUrl", () => ({
  resolveNotificationAppBaseUrl: () => resolveBaseUrlMock(),
}));

vi.mock("@/lib/zoho/zohoInvoicePaymentLogger", () => ({
  logZohoInvoicePaymentEvent: (...args: unknown[]) => logEventMock(...args),
}));

describe("generateZohoInvoiceAdminPaymentLink", () => {
  it("generates canonical /pay/{invoiceNumber} URL for valid invoice numbers", async () => {
    resolveBaseUrlMock.mockReturnValue("https://www.shalean.com");

    const result = await generateZohoInvoiceAdminPaymentLink("inv-001602");

    expect(result).toEqual({
      ok: true,
      invoiceNumber: "inv-001602",
      normalizedInvoiceNumber: "INV-001602",
      paymentLink: "https://www.shalean.com/pay/INV-001602",
    });
    expect(logEventMock).toHaveBeenCalledWith("zoho_invoice_admin_link_generated", {
      invoiceNumber: "INV-001602",
    });
  });

  it("rejects invalid invoice numbers", async () => {
    const result = await generateZohoInvoiceAdminPaymentLink("../bad");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_INVOICE_NUMBER");
    }
    expect(logEventMock).toHaveBeenCalledWith("zoho_invoice_admin_link_invalid", {
      invoiceNumber: "../bad",
      failureCode: "INVALID_INVOICE_NUMBER",
    });
  });

  it("returns safe error when base URL is missing", async () => {
    resolveBaseUrlMock.mockReturnValue("");

    const result = await generateZohoInvoiceAdminPaymentLink("INV-001602");

    expect(result).toEqual({
      ok: false,
      code: "APP_BASE_URL_MISSING",
      message: "Payment link base URL is not configured.",
    });
  });
});
