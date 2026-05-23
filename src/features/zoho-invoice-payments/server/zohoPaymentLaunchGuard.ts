import "server-only";

import { isPaystackEnabled } from "@/features/payments/server/paystackEnv";
import { isZohoBooksEnabled } from "@/lib/zoho/zohoEnv";

export type ZohoPaymentFeatureGateResult =
  | { ok: true }
  | { ok: false; code: string; message: string; status: number };

export type ZohoPaymentFeatureState = {
  invoicePaymentsEnabled: boolean;
  savedMethodsEnabled: boolean;
  adminCardChargesEnabled: boolean;
  zohoConfigured: boolean;
  paystackEnabled: boolean;
  paystackMode: "test" | "live" | "unknown" | "disabled";
  cronSecretConfigured: boolean;
  paystackWebhookConfigured: boolean;
};

function readFeatureFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw !== "false" && raw !== "0";
}

export function isZohoInvoicePaymentsEnabled(): boolean {
  return readFeatureFlag("ZOHO_INVOICE_PAYMENTS_ENABLED", true);
}

export function isZohoSavedMethodsEnabled(): boolean {
  return readFeatureFlag("ZOHO_SAVED_METHODS_ENABLED", true);
}

export function isZohoAdminCardChargesEnabled(): boolean {
  return readFeatureFlag("ZOHO_ADMIN_CARD_CHARGES_ENABLED", false);
}

export function getPaystackMode(): ZohoPaymentFeatureState["paystackMode"] {
  if (!isPaystackEnabled()) return "disabled";
  const key = process.env.PAYSTACK_SECRET_KEY?.trim() ?? "";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return "unknown";
}

export function getZohoPaymentFeatureState(): ZohoPaymentFeatureState {
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET?.trim();
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();

  return {
    invoicePaymentsEnabled: isZohoInvoicePaymentsEnabled(),
    savedMethodsEnabled: isZohoSavedMethodsEnabled(),
    adminCardChargesEnabled: isZohoAdminCardChargesEnabled(),
    zohoConfigured: isZohoBooksEnabled(),
    paystackEnabled: isPaystackEnabled(),
    paystackMode: getPaystackMode(),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    paystackWebhookConfigured: Boolean(webhookSecret && webhookSecret !== secretKey),
  };
}

export function requireZohoInvoicePaymentsEnabled(): ZohoPaymentFeatureGateResult {
  if (!isZohoInvoicePaymentsEnabled()) {
    return {
      ok: false,
      code: "INVOICE_PAYMENTS_DISABLED",
      message: "Online invoice payments are temporarily unavailable.",
      status: 503,
    };
  }
  return { ok: true };
}

export function requireZohoSavedMethodsEnabled(): ZohoPaymentFeatureGateResult {
  if (!isZohoSavedMethodsEnabled()) {
    return {
      ok: false,
      code: "SAVED_METHODS_DISABLED",
      message: "Saved payment methods are temporarily unavailable.",
      status: 503,
    };
  }
  return { ok: true };
}

export function requireZohoAdminCardChargesEnabled(): ZohoPaymentFeatureGateResult {
  if (!isZohoAdminCardChargesEnabled()) {
    return {
      ok: false,
      code: "ADMIN_CARD_CHARGES_DISABLED",
      message: "Admin saved-card charges are disabled.",
      status: 403,
    };
  }
  return { ok: true };
}
