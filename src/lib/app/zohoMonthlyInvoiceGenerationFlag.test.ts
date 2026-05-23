import { afterEach, describe, expect, it, vi } from "vitest";
import { isZohoMonthlyInvoiceGenerationEnabled } from "./zohoMonthlyInvoiceGenerationFlag";

describe("isZohoMonthlyInvoiceGenerationEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED", undefined);
    expect(isZohoMonthlyInvoiceGenerationEnabled()).toBe(false);
  });

  it("is false when only generation flag is on", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED", "true");
    expect(isZohoMonthlyInvoiceGenerationEnabled()).toBe(false);
  });

  it.each(["true", "1", "yes"])(
    "is active when billing, accrual, and generation flags are enabled (%s)",
    (value) => {
      vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED", value);
      expect(isZohoMonthlyInvoiceGenerationEnabled()).toBe(true);
    },
  );
});
