import { afterEach, describe, expect, it, vi } from "vitest";
import { isZohoMonthlyInvoiceAutomationEnabled } from "./zohoMonthlyInvoiceAutomationFlag";

describe("isZohoMonthlyInvoiceAutomationEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_AUTOMATION_ENABLED", undefined);
    expect(isZohoMonthlyInvoiceAutomationEnabled()).toBe(false);
  });

  it.each(["true", "1", "yes"])(
    "is active when billing chain and automation flag are enabled (%s)",
    (value) => {
      vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_PAYMENT_SYNC_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_OPERATIONS_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_AUTOMATION_ENABLED", value);
      expect(isZohoMonthlyInvoiceAutomationEnabled()).toBe(true);
    },
  );
});
