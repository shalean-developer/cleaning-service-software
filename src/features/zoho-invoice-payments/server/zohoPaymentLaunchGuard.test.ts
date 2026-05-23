import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getZohoPaymentFeatureState,
  isZohoAdminCardChargesEnabled,
  isZohoInvoicePaymentsEnabled,
  isZohoSavedMethodsEnabled,
  requireZohoAdminCardChargesEnabled,
  requireZohoInvoicePaymentsEnabled,
  requireZohoSavedMethodsEnabled,
} from "./zohoPaymentLaunchGuard";

describe("zohoPaymentLaunchGuard", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    delete process.env.ZOHO_INVOICE_PAYMENTS_ENABLED;
    delete process.env.ZOHO_SAVED_METHODS_ENABLED;
    delete process.env.ZOHO_ADMIN_CARD_CHARGES_ENABLED;
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("defaults invoice and saved methods enabled, admin charges disabled", () => {
    expect(isZohoInvoicePaymentsEnabled()).toBe(true);
    expect(isZohoSavedMethodsEnabled()).toBe(true);
    expect(isZohoAdminCardChargesEnabled()).toBe(false);
  });

  it("treats explicit false as disabled", () => {
    process.env.ZOHO_INVOICE_PAYMENTS_ENABLED = "false";
    process.env.ZOHO_SAVED_METHODS_ENABLED = "0";
    process.env.ZOHO_ADMIN_CARD_CHARGES_ENABLED = "false";

    expect(isZohoInvoicePaymentsEnabled()).toBe(false);
    expect(isZohoSavedMethodsEnabled()).toBe(false);
    expect(isZohoAdminCardChargesEnabled()).toBe(false);
  });

  it("require helpers return safe gate results", () => {
    process.env.ZOHO_INVOICE_PAYMENTS_ENABLED = "false";
    process.env.ZOHO_SAVED_METHODS_ENABLED = "false";
    process.env.ZOHO_ADMIN_CARD_CHARGES_ENABLED = "false";

    expect(requireZohoInvoicePaymentsEnabled()).toEqual({
      ok: false,
      code: "INVOICE_PAYMENTS_DISABLED",
      message: "Online invoice payments are temporarily unavailable.",
      status: 503,
    });
    expect(requireZohoSavedMethodsEnabled()).toEqual({
      ok: false,
      code: "SAVED_METHODS_DISABLED",
      message: "Saved payment methods are temporarily unavailable.",
      status: 503,
    });
    expect(requireZohoAdminCardChargesEnabled()).toEqual({
      ok: false,
      code: "ADMIN_CARD_CHARGES_DISABLED",
      message: "Admin saved-card charges are disabled.",
      status: 403,
    });
  });

  it("getZohoPaymentFeatureState exposes safe readiness without secrets", () => {
    process.env.PAYSTACK_ENABLED = "true";
    process.env.PAYSTACK_SECRET_KEY = "sk_test_example";
    process.env.CRON_SECRET = "cron-secret";
    process.env.PAYSTACK_WEBHOOK_SECRET = "whsec_different";

    const state = getZohoPaymentFeatureState();

    expect(state.paystackMode).toBe("test");
    expect(state.cronSecretConfigured).toBe(true);
    expect(state.paystackWebhookConfigured).toBe(true);
    expect(JSON.stringify(state)).not.toContain("sk_test_example");
    expect(JSON.stringify(state)).not.toContain("whsec_different");
  });
});
