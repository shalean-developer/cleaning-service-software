import { afterEach, describe, expect, it, vi } from "vitest";
import { isZohoMonthlyInvoiceOperationsEnabled } from "./zohoMonthlyInvoiceOperationsFlag";

describe("isZohoMonthlyInvoiceOperationsEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_PAYMENT_SYNC_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_OPERATIONS_ENABLED", undefined);
    expect(isZohoMonthlyInvoiceOperationsEnabled()).toBe(false);
  });

  it("is false when only operations flag is on", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_PAYMENT_SYNC_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_OPERATIONS_ENABLED", "true");
    expect(isZohoMonthlyInvoiceOperationsEnabled()).toBe(false);
  });

  it.each(["true", "1", "yes"])(
    "is active when billing, generation, payment sync, and operations flags are enabled (%s)",
    (value) => {
      vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_PAYMENT_SYNC_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_OPERATIONS_ENABLED", value);
      expect(isZohoMonthlyInvoiceOperationsEnabled()).toBe(true);
    },
  );
});
