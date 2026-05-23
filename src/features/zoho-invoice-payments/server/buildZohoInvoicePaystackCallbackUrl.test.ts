import { describe, expect, it, vi, afterEach } from "vitest";
import { buildZohoInvoicePaystackCallbackUrl } from "./buildZohoInvoicePaystackCallbackUrl";

describe("buildZohoInvoicePaystackCallbackUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses canonical deployed origin and skips localhost APP_BASE_URL", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
    vi.stubEnv("VERCEL_URL", "www.shalean.com");

    expect(buildZohoInvoicePaystackCallbackUrl("inv-001602", "zi_test_ref")).toBe(
      "https://www.shalean.com/pay/inv-001602/success?reference=zi_test_ref",
    );
  });

  it("uses localhost callback in local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("APP_BASE_URL", "http://localhost:3000");

    expect(buildZohoInvoicePaystackCallbackUrl("INV-001602", "zi_test_ref")).toBe(
      "http://localhost:3000/pay/INV-001602/success?reference=zi_test_ref",
    );
  });
});
