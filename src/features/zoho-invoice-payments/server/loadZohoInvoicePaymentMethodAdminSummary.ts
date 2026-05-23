import "server-only";

import {
  countActiveZohoInvoicePaymentMethods,
  formatMaskedPaymentMethodDisplay,
  getLatestZohoInvoicePaymentMethodConsentAt,
  listPaymentMethodsForAdmin,
  listRecentZohoInvoicePaymentMethodsForAdmin,
} from "./zohoInvoicePaymentMethodRepository";
import { maskCustomerEmailForDiagnostics } from "./zohoInvoiceDiagnosticRedaction";

export type AdminZohoSavedPaymentMethodRow = {
  id: string;
  maskedCustomerEmail: string;
  maskedCardDisplay: string;
  status: "active" | "revoked";
  isDefault: boolean;
  consentedAt: string;
  sourceInvoiceNumber: string | null;
};

export type AdminZohoSavedPaymentMethodsSummary = {
  activeCount: number;
  latestConsentAt: string | null;
  methods: AdminZohoSavedPaymentMethodRow[];
};

export async function loadZohoInvoicePaymentMethodAdminSummary(): Promise<AdminZohoSavedPaymentMethodsSummary> {
  const [activeCount, latestConsentAt, methods] = await Promise.all([
    countActiveZohoInvoicePaymentMethods(),
    getLatestZohoInvoicePaymentMethodConsentAt(),
    listRecentZohoInvoicePaymentMethodsForAdmin(20),
  ]);

  return {
    activeCount,
    latestConsentAt,
    methods: methods.map((method) => ({
      id: method.id,
      maskedCustomerEmail: maskCustomerEmailForDiagnostics(method.customer_email) ?? "—",
      maskedCardDisplay: formatMaskedPaymentMethodDisplay(method),
      status: method.revoked_at ? "revoked" : "active",
      isDefault: method.is_default,
      consentedAt: method.consented_at,
      sourceInvoiceNumber: method.source_invoice_number,
    })),
  };
}

export type AdminZohoPaymentMethodSafeDto = {
  id: string;
  card_type: string | null;
  bank: string | null;
  last4: string | null;
  exp_month: string | null;
  exp_year: string | null;
  reusable: boolean;
  is_default: boolean;
  consented_at: string;
  revoked_at: string | null;
  source_invoice_number: string | null;
  last_used_at: string | null;
  last_used_invoice_number: string | null;
};

export async function loadAdminZohoPaymentMethodsByEmail(
  customerEmail: string,
): Promise<AdminZohoPaymentMethodSafeDto[]> {
  const methods = await listPaymentMethodsForAdmin({
    customerEmail,
    status: "all",
    limit: 50,
  });
  return methods.map((method) => ({
    id: method.id,
    card_type: method.card_type,
    bank: method.bank,
    last4: method.last4,
    exp_month: method.exp_month,
    exp_year: method.exp_year,
    reusable: method.reusable,
    is_default: method.is_default,
    consented_at: method.consented_at,
    revoked_at: method.revoked_at,
    source_invoice_number: method.source_invoice_number,
    last_used_at: method.last_used_at,
    last_used_invoice_number: method.last_used_invoice_number,
  }));
}
