import "server-only";

import {
  ADMIN_REVOKE_CONFIRM_PHRASE,
  MIN_ADMIN_REVOKE_REASON_LENGTH,
} from "../adminRevokeConstants";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import { revokePaymentMethodByAdmin } from "./zohoInvoicePaymentMethodRepository";

export type RevokeAdminPaymentMethodInput = {
  paymentMethodId: string;
  adminProfileId: string;
  reason: string;
  confirmPhrase: string;
};

export type RevokeAdminPaymentMethodResult =
  | { ok: true; paymentMethodId: string; idempotent: boolean }
  | { ok: false; code: string; message: string; status: number };

export async function revokeAdminPaymentMethod(
  input: RevokeAdminPaymentMethodInput,
): Promise<RevokeAdminPaymentMethodResult> {
  const reason = input.reason?.trim() ?? "";
  if (reason.length < MIN_ADMIN_REVOKE_REASON_LENGTH) {
    return {
      ok: false,
      code: "INVALID_REASON",
      message: "A revoke reason of at least 10 characters is required.",
      status: 400,
    };
  }

  if (input.confirmPhrase?.trim() !== ADMIN_REVOKE_CONFIRM_PHRASE) {
    return {
      ok: false,
      code: "INVALID_CONFIRM_PHRASE",
      message: "Confirmation phrase must match exactly.",
      status: 400,
    };
  }

  logZohoInvoicePaymentEvent("zoho_invoice_payment_method_revoke_started", {
    actorType: "admin",
    adminProfileId: input.adminProfileId,
    paymentMethodId: input.paymentMethodId,
  });

  const result = await revokePaymentMethodByAdmin({
    paymentMethodId: input.paymentMethodId,
    adminProfileId: input.adminProfileId,
    reason,
  });

  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 500;
    logZohoInvoicePaymentEvent("zoho_invoice_payment_method_revoke_failed", {
      actorType: "admin",
      adminProfileId: input.adminProfileId,
      paymentMethodId: input.paymentMethodId,
      failureCode: result.code,
    });
    return { ok: false, code: result.code, message: result.message, status };
  }

  logZohoInvoicePaymentEvent("zoho_invoice_payment_method_revoked", {
    actorType: "admin",
    adminProfileId: input.adminProfileId,
    paymentMethodId: result.paymentMethodId,
    idempotent: result.idempotent,
    reason,
  });

  logZohoInvoicePaymentEvent("zoho_invoice_payment_method_audit_recorded", {
    actorType: "admin",
    adminProfileId: input.adminProfileId,
    paymentMethodId: result.paymentMethodId,
    action: "revoked",
  });

  return {
    ok: true,
    paymentMethodId: result.paymentMethodId,
    idempotent: result.idempotent,
  };
}
