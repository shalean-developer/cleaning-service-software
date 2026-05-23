import "server-only";

import { maskCustomerEmailForDiagnostics } from "./zohoInvoiceDiagnosticRedaction";
import {
  formatMaskedPaymentMethodDisplay,
  listPaymentMethodsForAdmin,
  type PaymentMethodAdminListFilters,
} from "./zohoInvoicePaymentMethodRepository";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import { toZohoInvoicePaymentMethodSafeDto } from "./zohoInvoicePaymentMethodSafeDto";

export type AdminPaymentMethodListItem = ReturnType<typeof toZohoInvoicePaymentMethodSafeDto> & {
  maskedCustomerEmail: string;
  maskedCardDisplay: string;
  status: "active" | "revoked";
};

export async function loadAdminPaymentMethodsList(
  filters: PaymentMethodAdminListFilters = {},
): Promise<{ methods: AdminPaymentMethodListItem[] }> {
  const rows = await listPaymentMethodsForAdmin(filters);

  logZohoInvoicePaymentEvent("zoho_invoice_payment_methods_listed", {
    actorType: "admin",
    methodCount: rows.length,
    statusFilter: filters.status ?? "all",
  });

  return {
    methods: rows.map((row) => ({
      ...toZohoInvoicePaymentMethodSafeDto(row),
      maskedCustomerEmail: maskCustomerEmailForDiagnostics(row.customer_email) ?? "—",
      maskedCardDisplay: formatMaskedPaymentMethodDisplay(row),
      status: row.revoked_at ? "revoked" : "active",
    })),
  };
}
