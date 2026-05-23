import "server-only";

import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import { revokePaymentMethodByCustomer } from "./zohoInvoicePaymentMethodRepository";
import { normalizeCustomerEmailForMatch } from "./zohoInvoiceCustomerEmailMatch";

export type RevokeCustomerPaymentMethodInput = {
  paymentMethodId: string;
  customerEmail: string;
  actorProfileId: string;
  reason?: string | null;
};

export type RevokeCustomerPaymentMethodResult =
  | { ok: true; paymentMethodId: string; idempotent: boolean }
  | { ok: false; code: string; message: string; status: number };

export async function revokeCustomerPaymentMethod(
  input: RevokeCustomerPaymentMethodInput,
): Promise<RevokeCustomerPaymentMethodResult> {
  logZohoInvoicePaymentEvent("zoho_invoice_payment_method_revoke_started", {
    actorType: "customer",
    paymentMethodId: input.paymentMethodId,
  });

  const result = await revokePaymentMethodByCustomer({
    paymentMethodId: input.paymentMethodId,
    customerEmail: normalizeCustomerEmailForMatch(input.customerEmail),
    actorProfileId: input.actorProfileId,
    reason: input.reason,
  });

  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "FORBIDDEN" ? 403 : 500;
    logZohoInvoicePaymentEvent("zoho_invoice_payment_method_revoke_failed", {
      actorType: "customer",
      paymentMethodId: input.paymentMethodId,
      failureCode: result.code,
    });
    return { ok: false, code: result.code, message: result.message, status };
  }

  logZohoInvoicePaymentEvent("zoho_invoice_payment_method_revoked", {
    actorType: "customer",
    paymentMethodId: result.paymentMethodId,
    idempotent: result.idempotent,
  });

  logZohoInvoicePaymentEvent("zoho_invoice_payment_method_audit_recorded", {
    actorType: "customer",
    paymentMethodId: result.paymentMethodId,
    action: "revoked",
  });

  return {
    ok: true,
    paymentMethodId: result.paymentMethodId,
    idempotent: result.idempotent,
  };
}
