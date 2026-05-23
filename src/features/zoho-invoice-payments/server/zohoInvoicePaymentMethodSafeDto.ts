import "server-only";

import type { ZohoInvoicePaymentMethodRow } from "@/lib/database/types";

export type ZohoInvoicePaymentMethodSafeDto = {
  id: string;
  cardType: string | null;
  bank: string | null;
  last4: string | null;
  expMonth: string | null;
  expYear: string | null;
  reusable: boolean;
  isDefault: boolean;
  consentedAt: string;
  revokedAt: string | null;
  sourceInvoiceNumber: string | null;
  lastUsedAt: string | null;
  lastUsedInvoiceNumber: string | null;
};

export function toZohoInvoicePaymentMethodSafeDto(
  row: ZohoInvoicePaymentMethodRow,
): ZohoInvoicePaymentMethodSafeDto {
  return {
    id: row.id,
    cardType: row.card_type,
    bank: row.bank,
    last4: row.last4,
    expMonth: row.exp_month,
    expYear: row.exp_year,
    reusable: row.reusable,
    isDefault: row.is_default,
    consentedAt: row.consented_at,
    revokedAt: row.revoked_at,
    sourceInvoiceNumber: row.source_invoice_number,
    lastUsedAt: row.last_used_at ?? null,
    lastUsedInvoiceNumber: row.last_used_invoice_number ?? null,
  };
}
