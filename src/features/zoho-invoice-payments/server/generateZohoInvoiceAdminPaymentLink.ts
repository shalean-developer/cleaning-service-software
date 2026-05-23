import "server-only";

import { resolveNotificationAppBaseUrl } from "@/lib/app/appBaseUrl";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import { buildZohoInvoicePaymentPageUrl } from "./buildZohoInvoicePaymentPageUrl";
import { validateAndNormalizeInvoiceNumber } from "./invoiceNumberValidation";

export type GenerateZohoInvoiceAdminPaymentLinkResult =
  | {
      ok: true;
      invoiceNumber: string;
      normalizedInvoiceNumber: string;
      paymentLink: string;
    }
  | { ok: false; code: "INVALID_INVOICE_NUMBER" | "APP_BASE_URL_MISSING"; message: string };

export async function generateZohoInvoiceAdminPaymentLink(
  rawInvoiceNumber: string,
): Promise<GenerateZohoInvoiceAdminPaymentLinkResult> {
  const validated = validateAndNormalizeInvoiceNumber(rawInvoiceNumber);
  if (!validated.ok) {
    logZohoInvoicePaymentEvent("zoho_invoice_admin_link_invalid", {
      invoiceNumber: rawInvoiceNumber?.trim() || null,
      failureCode: validated.code,
    });
    return validated;
  }

  const appBaseUrl = resolveNotificationAppBaseUrl();
  if (!appBaseUrl?.trim()) {
    return {
      ok: false,
      code: "APP_BASE_URL_MISSING",
      message: "Payment link base URL is not configured.",
    };
  }

  const paymentLink = buildZohoInvoicePaymentPageUrl(appBaseUrl, validated.normalized);

  logZohoInvoicePaymentEvent("zoho_invoice_admin_link_generated", {
    invoiceNumber: validated.normalized,
  });

  return {
    ok: true,
    invoiceNumber: rawInvoiceNumber.trim(),
    normalizedInvoiceNumber: validated.normalized,
    paymentLink,
  };
}
