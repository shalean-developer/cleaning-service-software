import "server-only";

import type { PaystackWebhookEvent } from "@/features/payments/server/paystackTypes";

export type PaystackWebhookPaymentSource =
  | "zoho_invoice_authorization_charge"
  | "zoho_invoice"
  | "booking";

function readMetadataSource(metadata: Record<string, unknown>): string | null {
  const source = metadata.source;
  return typeof source === "string" && source.trim() ? source.trim() : null;
}

export function detectPaystackWebhookPaymentSource(
  metadata: Record<string, unknown>,
  reference: string,
): PaystackWebhookPaymentSource {
  const source = readMetadataSource(metadata);
  if (source === "zoho_invoice_authorization_charge") {
    return "zoho_invoice_authorization_charge";
  }
  if (source === "zoho_invoice") return "zoho_invoice";
  if (source === "booking") return "booking";
  if (reference.startsWith("zia_")) return "zoho_invoice_authorization_charge";
  if (reference.startsWith("zi_")) return "zoho_invoice";
  if (reference.startsWith("bk_")) return "booking";
  return "booking";
}

export function buildZohoInvoiceWebhookProviderEventId(
  eventType: "charge.success" | "charge.failed",
  transactionId: number,
): string {
  return `paystack:${eventType}:${transactionId}`;
}

export function buildZohoInvoiceAuthorizationChargeWebhookProviderEventId(
  eventType: "charge.success" | "charge.failed",
  transactionId: number,
): string {
  return `paystack:auth-charge:${eventType}:${transactionId}`;
}

export function readZohoInvoicePaymentIdFromMetadata(
  metadata: Record<string, unknown>,
): string | null {
  const value = metadata.zoho_invoice_payment_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readAuthorizationChargeIdFromMetadata(
  metadata: Record<string, unknown>,
): string | null {
  const value = metadata.authorization_charge_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export type RoutedWebhookContext = {
  event: PaystackWebhookEvent;
  source: PaystackWebhookPaymentSource;
};
