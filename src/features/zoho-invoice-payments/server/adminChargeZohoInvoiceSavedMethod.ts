import "server-only";

import {
  buildSafeInvoiceFieldsFromZoho,
  extractZohoInvoiceCustomerEmail,
  getZohoInvoiceByNumber,
} from "@/lib/zoho/invoices";
import { isZohoBooksEnabled } from "@/lib/zoho/zohoEnv";
import { isZohoConfigError } from "@/lib/zoho/zohoClient";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import { PaystackApiError } from "@/features/payments/server/paystackClient";
import { isPaystackEnabled } from "@/features/payments/server/paystackEnv";
import { chargeSavedAuthorization } from "./chargeSavedAuthorization";
import { validateAndNormalizeInvoiceNumber } from "./invoiceNumberValidation";
import { mapZohoInvoiceToPublicStatus } from "./mapZohoInvoiceToPublicStatus";
import { buildZohoInvoiceAuthorizationChargeReference } from "./buildZohoInvoiceAuthorizationChargeReference";
import {
  createAuthorizationChargeAttempt,
  findActiveAuthorizationChargeByInvoiceNumber,
  markAuthorizationChargeFailed,
  markAuthorizationChargeSubmitted,
  updateAuthorizationChargeReference,
} from "./zohoInvoiceAuthorizationChargeRepository";
import { findZohoInvoicePaymentMethodById } from "./zohoInvoicePaymentMethodRepository";
import { customerEmailsMatchForZohoCharge } from "./zohoInvoiceCustomerEmailMatch";
import { isPaymentMethodExpired } from "./zohoInvoicePaymentMethodExpiry";
import { markPaymentMethodLastUsed } from "./zohoInvoicePaymentMethodRepository";
import {
  ADMIN_CHARGE_CONFIRM_PHRASE,
  MIN_ADMIN_CHARGE_REASON_LENGTH,
} from "../adminChargeConstants";
import { requireZohoAdminCardChargesEnabled } from "./zohoPaymentLaunchGuard";

export { ADMIN_CHARGE_CONFIRM_PHRASE, MIN_ADMIN_CHARGE_REASON_LENGTH };

export type AdminChargeZohoInvoiceSavedMethodInput = {
  adminProfileId: string;
  invoiceNumber: string;
  paymentMethodId: string;
  reason: string;
  confirmPhrase: string;
};

export type AdminChargeZohoInvoiceSavedMethodSuccess = {
  ok: true;
  reference: string;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  status: string;
};

export type AdminChargeZohoInvoiceSavedMethodFailure = {
  ok: false;
  code: string;
  message: string;
  status: number;
};

export type AdminChargeZohoInvoiceSavedMethodResult =
  | AdminChargeZohoInvoiceSavedMethodSuccess
  | AdminChargeZohoInvoiceSavedMethodFailure;

function failure(
  code: string,
  message: string,
  status: number,
  details: Record<string, unknown> = {},
): AdminChargeZohoInvoiceSavedMethodFailure {
  logZohoInvoicePaymentEvent("zoho_invoice_admin_charge_blocked", {
    failureCode: code,
    ...details,
  });
  return { ok: false, code, message, status };
}

export async function adminChargeZohoInvoiceSavedMethod(
  input: AdminChargeZohoInvoiceSavedMethodInput,
): Promise<AdminChargeZohoInvoiceSavedMethodResult> {
  const validated = validateAndNormalizeInvoiceNumber(input.invoiceNumber);
  if (!validated.ok) {
    return failure("INVALID_INVOICE_NUMBER", validated.message, 400, {
      invoiceNumber: input.invoiceNumber?.trim() || null,
    });
  }

  const normalized = validated.normalized;
  const reason = input.reason?.trim() ?? "";
  if (reason.length < MIN_ADMIN_CHARGE_REASON_LENGTH) {
    return failure(
      "INVALID_REASON",
      "A charge reason of at least 10 characters is required.",
      400,
      { invoiceNumber: normalized },
    );
  }

  if (input.confirmPhrase?.trim() !== ADMIN_CHARGE_CONFIRM_PHRASE) {
    return failure(
      "INVALID_CONFIRM_PHRASE",
      "Confirmation phrase must match exactly.",
      400,
      { invoiceNumber: normalized },
    );
  }

  const adminChargesGate = requireZohoAdminCardChargesEnabled();
  if (!adminChargesGate.ok) {
    return failure(
      adminChargesGate.code,
      adminChargesGate.message,
      adminChargesGate.status,
      { invoiceNumber: normalized },
    );
  }

  if (!input.paymentMethodId?.trim()) {
    return failure("INVALID_PAYMENT_METHOD", "Payment method is required.", 400, {
      invoiceNumber: normalized,
    });
  }

  logZohoInvoicePaymentEvent("zoho_invoice_admin_charge_started", {
    invoiceNumber: normalized,
    adminProfileId: input.adminProfileId,
    paymentMethodId: input.paymentMethodId,
    action: "charge_saved_card_requested",
    reason,
  });

  if (!isZohoBooksEnabled()) {
    return failure("NOT_CONFIGURED", "Online invoice payments are not available yet.", 503, {
      invoiceNumber: normalized,
    });
  }

  if (!isPaystackEnabled()) {
    return failure("PAYSTACK_DISABLED", "Online card payments are temporarily unavailable.", 503, {
      invoiceNumber: normalized,
    });
  }

  let lookup: Awaited<ReturnType<typeof getZohoInvoiceByNumber>>;
  try {
    lookup = await getZohoInvoiceByNumber(normalized);
  } catch (error) {
    if (isZohoConfigError(error)) {
      return failure("NOT_CONFIGURED", "Online invoice payments are not available yet.", 503, {
        invoiceNumber: normalized,
      });
    }
    return failure(
      "ZOHO_API_ERROR",
      "Could not verify this invoice. Please try again later.",
      502,
      { invoiceNumber: normalized },
    );
  }

  if (!lookup.ok) {
    const code = lookup.code === "NOT_FOUND" ? "NOT_FOUND" : "ZOHO_API_ERROR";
    return failure(
      code,
      code === "NOT_FOUND" ? "We could not find this invoice." : "Could not verify this invoice.",
      code === "NOT_FOUND" ? 404 : 502,
      { invoiceNumber: normalized },
    );
  }

  const fields = buildSafeInvoiceFieldsFromZoho(lookup.invoice);
  const publicStatus = mapZohoInvoiceToPublicStatus({
    zohoStatus: lookup.invoice.status,
    balanceCents: fields.amountDueCents,
    invoiceTotalCents: fields.amountDueCents,
  });

  if (publicStatus !== "payable" || fields.amountDueCents <= 0) {
    return failure(
      "NOT_PAYABLE",
      "This invoice is not available for charging.",
      409,
      { invoiceNumber: normalized, publicStatus },
    );
  }

  const invoiceEmail = extractZohoInvoiceCustomerEmail(lookup.invoice);
  if (!invoiceEmail) {
    return failure(
      "MISSING_CUSTOMER_EMAIL",
      "This invoice cannot be charged online yet.",
      409,
      { invoiceNumber: normalized },
    );
  }

  const paymentMethod = await findZohoInvoicePaymentMethodById(input.paymentMethodId.trim());
  if (!paymentMethod) {
    return failure("PAYMENT_METHOD_NOT_FOUND", "Saved payment method not found.", 404, {
      invoiceNumber: normalized,
    });
  }

  if (paymentMethod.revoked_at) {
    return failure("PAYMENT_METHOD_REVOKED", "This saved payment method is no longer active.", 409, {
      invoiceNumber: normalized,
    });
  }

  if (!paymentMethod.reusable) {
    return failure(
      "PAYMENT_METHOD_NOT_REUSABLE",
      "This saved payment method cannot be charged.",
      409,
      { invoiceNumber: normalized },
    );
  }

  if (isPaymentMethodExpired(paymentMethod.exp_month, paymentMethod.exp_year)) {
    return failure(
      "PAYMENT_METHOD_EXPIRED",
      "This saved payment method has expired and cannot be charged.",
      409,
      { invoiceNumber: normalized },
    );
  }

  if (!customerEmailsMatchForZohoCharge(invoiceEmail, paymentMethod.customer_email)) {
    return failure(
      "CUSTOMER_EMAIL_MISMATCH",
      "This saved payment method does not match the invoice customer.",
      409,
      { invoiceNumber: normalized },
    );
  }

  const activeCharge = await findActiveAuthorizationChargeByInvoiceNumber(normalized);
  if (activeCharge) {
    return failure(
      "ACTIVE_CHARGE_EXISTS",
      "An authorization charge is already in progress for this invoice.",
      409,
      { invoiceNumber: normalized },
    );
  }

  const pendingReference = `zia_pending_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  let chargeAttempt: Awaited<ReturnType<typeof createAuthorizationChargeAttempt>>;
  try {
    chargeAttempt = await createAuthorizationChargeAttempt({
      invoiceNumber: normalized,
      zohoInvoiceId: lookup.invoice.invoice_id,
      paymentMethodId: paymentMethod.id,
      customerEmail: invoiceEmail,
      amountCents: fields.amountDueCents,
      currency: fields.currency,
      paystackReference: pendingReference,
      initiatedByAdminId: input.adminProfileId,
      reason,
      metadata: {
        charge_saved_card_requested: true,
        admin_profile_id: input.adminProfileId,
      },
    });
  } catch {
    return failure("PERSISTENCE_ERROR", "Could not start the charge attempt.", 500, {
      invoiceNumber: normalized,
    });
  }

  const reference = buildZohoInvoiceAuthorizationChargeReference(normalized, chargeAttempt.id);
  try {
    chargeAttempt = await updateAuthorizationChargeReference(chargeAttempt.id, reference);
  } catch {
    await markAuthorizationChargeFailed(chargeAttempt.id, {
      reason: "reference_update_failed",
    });
    return failure("PERSISTENCE_ERROR", "Could not start the charge attempt.", 500, {
      invoiceNumber: normalized,
    });
  }

  try {
    const paystackResponse = await chargeSavedAuthorization({
      email: invoiceEmail,
      amountCents: fields.amountDueCents,
      currency: fields.currency,
      authorizationCode: paymentMethod.authorization_code,
      reference,
      invoiceNumber: normalized,
      zohoInvoiceId: lookup.invoice.invoice_id,
      paymentMethodId: paymentMethod.id,
      authorizationChargeId: chargeAttempt.id,
      initiatedByAdminId: input.adminProfileId,
    });

    const updated = await markAuthorizationChargeSubmitted(chargeAttempt.id, {
      paystackStatus: paystackResponse.data.status,
      metadata: {
        charge_saved_card_outcome: "submitted",
      },
    });

    try {
      await markPaymentMethodLastUsed({
        paymentMethodId: paymentMethod.id,
        invoiceNumber: normalized,
      });
      logZohoInvoicePaymentEvent("zoho_invoice_payment_method_last_used_updated", {
        paymentMethodId: paymentMethod.id,
        invoiceNumber: normalized,
      });
    } catch {
      // Non-blocking: charge submission already succeeded.
    }

    logZohoInvoicePaymentEvent("zoho_invoice_admin_charge_submitted", {
      invoiceNumber: normalized,
      adminProfileId: input.adminProfileId,
      paymentMethodId: paymentMethod.id,
      paystackReference: reference,
      amountCents: fields.amountDueCents,
      action: "charge_saved_card_requested",
      reason,
      outcome: "submitted",
    });

    return {
      ok: true,
      reference,
      invoiceNumber: normalized,
      amountCents: fields.amountDueCents,
      currency: fields.currency,
      status: updated.status,
    };
  } catch (error) {
    const safeError =
      error instanceof PaystackApiError
        ? `paystack_charge_api_${error.statusCode}`
        : "paystack_charge_failed";

    await markAuthorizationChargeFailed(chargeAttempt.id, {
      paystackStatus: "failed",
      reason: safeError,
    });

    logZohoInvoicePaymentEvent("zoho_invoice_admin_charge_failed", {
      invoiceNumber: normalized,
      adminProfileId: input.adminProfileId,
      paymentMethodId: paymentMethod.id,
      paystackReference: reference,
      failureCode: safeError,
      action: "charge_saved_card_requested",
      reason,
      outcome: "failed",
    });

    return failure(
      "PAYSTACK_CHARGE_FAILED",
      "The card charge could not be submitted. Check the saved card or try again later.",
      502,
      { invoiceNumber: normalized, paystackReference: reference },
    );
  }
}
