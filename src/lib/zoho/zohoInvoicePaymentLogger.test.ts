import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  logZohoInvoiceFetchFailureDev,
  logZohoOAuthFailureDev,
} from "./zohoInvoicePaymentLogger";

describe("zoho dev-only fetch logging", () => {
  const envSnapshot = process.env.NODE_ENV;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = envSnapshot;
    warnSpy.mockRestore();
  });

  it("logs sanitized invoice fetch failures in non-production", () => {
    logZohoInvoiceFetchFailureDev({
      httpStatus: 502,
      zohoResponseCode: 57,
      zohoResponseMessage: "Invalid value passed for invoice_number",
      endpointPath: "/invoices",
      queryParams: { invoice_number: "INV-001602", organization_id: "925151166" },
      invoiceNumber: "INV-001602",
      lookupMethod: "invoice_number",
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(warnSpy.mock.calls[0]?.[0]));
    expect(payload.event).toBe("zoho_invoice_fetch_debug");
    expect(payload.httpStatus).toBe(502);
    expect(payload.invoiceNumber).toBe("INV-001602");
    expect(JSON.stringify(payload)).not.toContain("access_token");
    expect(JSON.stringify(payload)).not.toContain("refresh_token");
  });

  it("does not log invoice fetch failures in production", () => {
    process.env.NODE_ENV = "production";
    logZohoInvoiceFetchFailureDev({
      httpStatus: 502,
      endpointPath: "/invoices",
      queryParams: { invoice_number: "INV-001602" },
      invoiceNumber: "INV-001602",
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs sanitized oauth failures in non-production", () => {
    logZohoOAuthFailureDev({
      httpStatus: 200,
      zohoResponseMessage: "invalid_code",
      endpointPath: "/oauth/v2/token",
      queryParams: { grant_type: "refresh_token", client_id: "[redacted]" },
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(warnSpy.mock.calls[0]?.[0]));
    expect(payload.event).toBe("zoho_oauth_refresh_debug");
    expect(payload.zohoResponseMessage).toBe("invalid_code");
    expect(JSON.stringify(payload)).not.toContain("client_secret");
  });
});
