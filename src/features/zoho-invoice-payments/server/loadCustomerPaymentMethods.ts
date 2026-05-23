import "server-only";

import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import { normalizeCustomerEmailForMatch } from "./zohoInvoiceCustomerEmailMatch";
import { listPaymentMethodsForCustomerEmail } from "./zohoInvoicePaymentMethodRepository";
import { toZohoInvoicePaymentMethodSafeDto } from "./zohoInvoicePaymentMethodSafeDto";

export async function loadCustomerPaymentMethods(customerEmail: string) {
  const normalized = normalizeCustomerEmailForMatch(customerEmail);
  const rows = await listPaymentMethodsForCustomerEmail(normalized);

  logZohoInvoicePaymentEvent("zoho_invoice_payment_methods_listed", {
    actorType: "customer",
    methodCount: rows.length,
  });

  return {
    methods: rows.map(toZohoInvoicePaymentMethodSafeDto),
  };
}
