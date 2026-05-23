import { afterEach, describe, expect, it, vi } from "vitest";
import { isZohoMonthlyInvoicePaymentSyncEnabled } from "./zohoMonthlyInvoicePaymentSyncFlag";

describe("isZohoMonthlyInvoicePaymentSyncEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_PAYMENT_SYNC_ENABLED", undefined);
    expect(isZohoMonthlyInvoicePaymentSyncEnabled()).toBe(false);
  });

  it("is false when only payment sync flag is on", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_PAYMENT_SYNC_ENABLED", "true");
    expect(isZohoMonthlyInvoicePaymentSyncEnabled()).toBe(false);
  });

  it.each(["true", "1", "yes"])(
    "is active when billing, generation, and payment sync flags are enabled (%s)",
    (value) => {
      vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_PAYMENT_SYNC_ENABLED", value);
      expect(isZohoMonthlyInvoicePaymentSyncEnabled()).toBe(true);
    },
  );
});
