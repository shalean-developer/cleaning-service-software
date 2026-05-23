import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const initializeMock = vi.fn();

vi.mock("@/features/zoho-invoice-payments/server/initializeZohoInvoicePayment", () => ({
  initializeZohoInvoicePayment: (...args: unknown[]) => initializeMock(...args),
}));

describe("POST /api/paystack/initialize-zoho-invoice", () => {
  beforeEach(() => {
    initializeMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns authorizationUrl on success", async () => {
    initializeMock.mockResolvedValue({
      ok: true,
      authorizationUrl: "https://checkout.paystack.com/test",
      accessCode: "access",
      reference: "zi_test",
      invoiceNumber: "INV-001602",
      amountCents: 10_000,
      currency: "ZAR",
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber: "INV-001602" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.authorizationUrl).toBe("https://checkout.paystack.com/test");
    expect(initializeMock).toHaveBeenCalledWith("INV-001602", {
      savePaymentMethodConsent: false,
    });
  });

  it("returns safe errors without internal details", async () => {
    initializeMock.mockResolvedValue({
      ok: false,
      code: "PAYSTACK_INIT_FAILED",
      message: "We could not start payment for this invoice. Please try again later.",
      status: 502,
    });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber: "INV-001602" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.message).not.toMatch(/Paystack|ZOHO_/i);
  });
});
