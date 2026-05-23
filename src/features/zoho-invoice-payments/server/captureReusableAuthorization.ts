import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import type { Database, Json, ZohoInvoicePaymentRow } from "@/lib/database/types";
import type { PaystackVerifyData } from "@/features/payments/server/paystackTypes";
import {
  readSavePaymentMethodRequestedFromMetadata,
  type AuthorizationCaptureOutcome,
} from "./zohoInvoiceSavePaymentMethodConsent";
import {
  findActiveDefaultZohoInvoicePaymentMethodByEmail,
  insertZohoInvoicePaymentMethod,
} from "./zohoInvoicePaymentMethodRepository";
import { mergeZohoInvoicePaymentMetadata } from "./zohoInvoicePaymentRepository";
import { isZohoSavedMethodsEnabled } from "./zohoPaymentLaunchGuard";

export type CaptureReusableAuthorizationResult = {
  outcome: AuthorizationCaptureOutcome;
  saved: boolean;
};

function readConsentTextVersion(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const version = (metadata as Record<string, unknown>).consent_text_version;
  return typeof version === "string" && version.trim() ? version.trim() : null;
}

function readConsentRequestedAt(metadata: unknown): string {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return new Date().toISOString();
  }
  const value = (metadata as Record<string, unknown>).consent_requested_at;
  return typeof value === "string" && value.trim() ? value.trim() : new Date().toISOString();
}

async function recordCaptureOutcome(
  paymentRowId: string,
  outcome: AuthorizationCaptureOutcome,
  client: SupabaseClient<Database>,
): Promise<void> {
  await mergeZohoInvoicePaymentMetadata(
    paymentRowId,
    { authorization_capture_outcome: outcome },
    client,
  );
}

export async function captureReusableAuthorization(
  paymentRow: ZohoInvoicePaymentRow,
  verifyData: PaystackVerifyData,
  client: SupabaseClient<Database>,
): Promise<CaptureReusableAuthorizationResult> {
  const consentRequested = readSavePaymentMethodRequestedFromMetadata(paymentRow.metadata);

  if (!consentRequested) {
    logZohoInvoicePaymentEvent("zoho_invoice_authorization_capture_skipped_not_requested", {
      invoiceNumber: paymentRow.invoice_number,
      zohoInvoicePaymentId: paymentRow.id,
    });
    await recordCaptureOutcome(paymentRow.id, "not_requested", client);
    return { outcome: "not_requested", saved: false };
  }

  if (!isZohoSavedMethodsEnabled()) {
    logZohoInvoicePaymentEvent("zoho_saved_methods_feature_disabled", {
      invoiceNumber: paymentRow.invoice_number,
      zohoInvoicePaymentId: paymentRow.id,
      reason: "authorization_capture",
    });
    await recordCaptureOutcome(paymentRow.id, "not_requested", client);
    return { outcome: "not_requested", saved: false };
  }

  logZohoInvoicePaymentEvent("zoho_invoice_authorization_capture_started", {
    invoiceNumber: paymentRow.invoice_number,
    zohoInvoicePaymentId: paymentRow.id,
  });

  const authorization = verifyData.authorization;
  if (!authorization?.reusable) {
    logZohoInvoicePaymentEvent("zoho_invoice_authorization_capture_skipped_not_reusable", {
      invoiceNumber: paymentRow.invoice_number,
      zohoInvoicePaymentId: paymentRow.id,
    });
    await recordCaptureOutcome(paymentRow.id, "not_reusable", client);
    return { outcome: "not_reusable", saved: false };
  }

  const authorizationCode = authorization.authorization_code?.trim();
  if (!authorizationCode) {
    logZohoInvoicePaymentEvent("zoho_invoice_authorization_capture_failed", {
      invoiceNumber: paymentRow.invoice_number,
      zohoInvoicePaymentId: paymentRow.id,
      failureCode: "MISSING_AUTHORIZATION_CODE",
    });
    await recordCaptureOutcome(paymentRow.id, "missing_authorization_code", client);
    return { outcome: "missing_authorization_code", saved: false };
  }

  const consentTextVersion = readConsentTextVersion(paymentRow.metadata);
  if (!consentTextVersion) {
    logZohoInvoicePaymentEvent("zoho_invoice_authorization_capture_failed", {
      invoiceNumber: paymentRow.invoice_number,
      zohoInvoicePaymentId: paymentRow.id,
      failureCode: "MISSING_CONSENT_VERSION",
    });
    await recordCaptureOutcome(paymentRow.id, "failed", client);
    return { outcome: "failed", saved: false };
  }

  try {
    const existingDefault = await findActiveDefaultZohoInvoicePaymentMethodByEmail(
      paymentRow.customer_email,
      client,
    );

    const inserted = await insertZohoInvoicePaymentMethod(
      {
        customerEmail: paymentRow.customer_email,
        customerName: paymentRow.customer_name,
        paystackCustomerCode: verifyData.customer?.customer_code?.trim() || null,
        authorizationCode,
        authorizationSignature: authorization.signature?.trim() || null,
        cardType: authorization.card_type?.trim() || null,
        bank: authorization.bank?.trim() || null,
        last4: authorization.last4?.trim() || null,
        expMonth: authorization.exp_month != null ? String(authorization.exp_month) : null,
        expYear: authorization.exp_year != null ? String(authorization.exp_year) : null,
        reusable: true,
        isDefault: !existingDefault,
        consentTextVersion,
        consentedAt: readConsentRequestedAt(paymentRow.metadata),
        sourceInvoiceNumber: paymentRow.invoice_number,
        sourceZohoInvoicePaymentId: paymentRow.id,
      },
      client,
    );

    if (inserted.duplicate) {
      logZohoInvoicePaymentEvent("zoho_invoice_payment_method_duplicate", {
        invoiceNumber: paymentRow.invoice_number,
        zohoInvoicePaymentId: paymentRow.id,
        zohoInvoicePaymentMethodId: inserted.row.id,
      });
    } else {
      logZohoInvoicePaymentEvent("zoho_invoice_payment_method_saved", {
        invoiceNumber: paymentRow.invoice_number,
        zohoInvoicePaymentId: paymentRow.id,
        zohoInvoicePaymentMethodId: inserted.row.id,
      });
    }

    logZohoInvoicePaymentEvent("zoho_invoice_authorization_capture_succeeded", {
      invoiceNumber: paymentRow.invoice_number,
      zohoInvoicePaymentId: paymentRow.id,
      zohoInvoicePaymentMethodId: inserted.row.id,
      duplicate: inserted.duplicate,
    });

    await recordCaptureOutcome(paymentRow.id, "saved", client);
    return { outcome: "saved", saved: true };
  } catch (error) {
    logZohoInvoicePaymentEvent("zoho_invoice_authorization_capture_failed", {
      invoiceNumber: paymentRow.invoice_number,
      zohoInvoicePaymentId: paymentRow.id,
      failureCode: "PERSISTENCE_ERROR",
      errorMessage: error instanceof Error ? error.message : "unknown",
    });
    await recordCaptureOutcome(paymentRow.id, "failed", client);
    return { outcome: "failed", saved: false };
  }
}
