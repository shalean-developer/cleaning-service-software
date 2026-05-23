import { afterEach, describe, expect, it, vi } from "vitest";
import { startZohoInvoicePaystackCheckout } from "./startZohoInvoicePaystackCheckout";

describe("startZohoInvoicePaystackCheckout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts invoiceNumber only and returns authorizationUrl", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          authorizationUrl: "https://checkout.paystack.com/test",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await startZohoInvoicePaystackCheckout("INV-001602");
    expect(result).toEqual({
      ok: true,
      authorizationUrl: "https://checkout.paystack.com/test",
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/paystack/initialize-zoho-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      invoiceNumber: "INV-001602",
      savePaymentMethodConsent: false,
    }),
    });
  });

  it("sends savePaymentMethodConsent when requested", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, authorizationUrl: "https://checkout.paystack.com/test" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await startZohoInvoicePaystackCheckout("INV-001602", { savePaymentMethodConsent: true });

    expect(fetchMock).toHaveBeenCalledWith("/api/paystack/initialize-zoho-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNumber: "INV-001602",
        savePaymentMethodConsent: true,
      }),
    });
  });

  it("returns safe error message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          error: "PAYSTACK_INIT_FAILED",
          message: "We could not start payment for this invoice. Please try again later.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await startZohoInvoicePaystackCheckout("INV-001602");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toMatch(/PAYSTACK_INIT_FAILED/);
  });
});
