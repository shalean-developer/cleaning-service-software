import "server-only";

import { paystackChargeAuthorization } from "@/features/payments/server/paystackClient";

export type ChargeSavedAuthorizationInput = {
  email: string;
  amountCents: number;
  currency: string;
  authorizationCode: string;
  reference: string;
  invoiceNumber: string;
  zohoInvoiceId: string;
  paymentMethodId: string;
  authorizationChargeId: string;
  initiatedByAdminId: string;
};

export async function chargeSavedAuthorization(input: ChargeSavedAuthorizationInput) {
  return paystackChargeAuthorization({
    email: input.email.trim(),
    amount: input.amountCents,
    authorization_code: input.authorizationCode,
    reference: input.reference,
    currency: input.currency,
    metadata: {
      source: "zoho_invoice_authorization_charge",
      invoice_number: input.invoiceNumber,
      zoho_invoice_id: input.zohoInvoiceId,
      payment_method_id: input.paymentMethodId,
      authorization_charge_id: input.authorizationChargeId,
      initiated_by_admin_id: input.initiatedByAdminId,
    },
  });
}
