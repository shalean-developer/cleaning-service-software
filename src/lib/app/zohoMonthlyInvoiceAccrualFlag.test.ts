import { afterEach, describe, expect, it, vi } from "vitest";
import { isZohoMonthlyInvoiceAccrualEnabled } from "./zohoMonthlyInvoiceAccrualFlag";

describe("isZohoMonthlyInvoiceAccrualEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is false by default", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", undefined);
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", undefined);
    expect(isZohoMonthlyInvoiceAccrualEnabled()).toBe(false);
  });

  it("is false when only accrual flag is on", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", "false");
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", "true");
    expect(isZohoMonthlyInvoiceAccrualEnabled()).toBe(false);
  });

  it("is false when parent flags on but accrual off", () => {
    vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "true");
    vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", "true");
    vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", "false");
    expect(isZohoMonthlyInvoiceAccrualEnabled()).toBe(false);
  });

  it.each(["true", "1", "yes"])(
    "is active when all three flags are enabled (%s)",
    (value) => {
      vi.stubEnv("ZOHO_MONTHLY_ACCOUNT_BILLING_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_SERVICE_AUTHORIZATION_ENABLED", "true");
      vi.stubEnv("ZOHO_MONTHLY_INVOICE_ACCRUAL_ENABLED", value);
      expect(isZohoMonthlyInvoiceAccrualEnabled()).toBe(true);
    },
  );
});
