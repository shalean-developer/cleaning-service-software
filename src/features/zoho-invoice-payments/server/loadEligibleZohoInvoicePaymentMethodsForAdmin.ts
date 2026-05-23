import "server-only";

import {
  buildSafeInvoiceFieldsFromZoho,
  extractZohoInvoiceCustomerEmail,
  getZohoInvoiceByNumber,
} from "@/lib/zoho/invoices";
import { isZohoBooksEnabled } from "@/lib/zoho/zohoEnv";
import { isZohoConfigError } from "@/lib/zoho/zohoClient";
import { validateAndNormalizeInvoiceNumber } from "./invoiceNumberValidation";
import { mapZohoInvoiceToPublicStatus } from "./mapZohoInvoiceToPublicStatus";
import { normalizeCustomerEmailForMatch } from "./zohoInvoiceCustomerEmailMatch";
import { listEligibleZohoInvoicePaymentMethodsForEmail } from "./zohoInvoicePaymentMethodRepository";
import type { AdminZohoPaymentMethodSafeDto } from "./loadZohoInvoicePaymentMethodAdminSummary";

export type LoadEligibleZohoInvoicePaymentMethodsResult =
  | {
      ok: true;
      invoiceNumber: string;
      customerName: string | null;
      amountDueCents: number;
      currency: string;
      canCharge: boolean;
      methods: AdminZohoPaymentMethodSafeDto[];
    }
  | {
      ok: false;
      code: string;
      message: string;
      status: number;
    };

function toSafeDto(
  method: Awaited<ReturnType<typeof listEligibleZohoInvoicePaymentMethodsForEmail>>[number],
): AdminZohoPaymentMethodSafeDto {
  return {
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
  };
}

export async function loadEligibleZohoInvoicePaymentMethodsForAdmin(
  rawInvoiceNumber: string,
): Promise<LoadEligibleZohoInvoicePaymentMethodsResult> {
  const validated = validateAndNormalizeInvoiceNumber(rawInvoiceNumber);
  if (!validated.ok) {
    return {
      ok: false,
      code: "INVALID_INVOICE_NUMBER",
      message: validated.message,
      status: 400,
    };
  }

  if (!isZohoBooksEnabled()) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message: "Online invoice payments are not available yet.",
      status: 503,
    };
  }

  const normalized = validated.normalized;
  let lookup: Awaited<ReturnType<typeof getZohoInvoiceByNumber>>;
  try {
    lookup = await getZohoInvoiceByNumber(normalized);
  } catch (error) {
    if (isZohoConfigError(error)) {
      return {
        ok: false,
        code: "NOT_CONFIGURED",
        message: "Online invoice payments are not available yet.",
        status: 503,
      };
    }
    return {
      ok: false,
      code: "ZOHO_API_ERROR",
      message: "Could not verify this invoice.",
      status: 502,
    };
  }

  if (!lookup.ok) {
    return {
      ok: false,
      code: lookup.code === "NOT_FOUND" ? "NOT_FOUND" : "ZOHO_API_ERROR",
      message:
        lookup.code === "NOT_FOUND"
          ? "We could not find this invoice."
          : "Could not verify this invoice.",
      status: lookup.code === "NOT_FOUND" ? 404 : 502,
    };
  }

  const fields = buildSafeInvoiceFieldsFromZoho(lookup.invoice);
  const publicStatus = mapZohoInvoiceToPublicStatus({
    zohoStatus: lookup.invoice.status,
    balanceCents: fields.amountDueCents,
    invoiceTotalCents: fields.amountDueCents,
  });
  const invoiceEmail = extractZohoInvoiceCustomerEmail(lookup.invoice);
  const canCharge =
    publicStatus === "payable" && fields.amountDueCents > 0 && Boolean(invoiceEmail);

  if (!canCharge || !invoiceEmail) {
    return {
      ok: true,
      invoiceNumber: normalized,
      customerName: fields.customerName,
      amountDueCents: fields.amountDueCents,
      currency: fields.currency,
      canCharge: false,
      methods: [],
    };
  }

  const methods = await listEligibleZohoInvoicePaymentMethodsForEmail(
    normalizeCustomerEmailForMatch(invoiceEmail),
  );

  return {
    ok: true,
    invoiceNumber: normalized,
    customerName: fields.customerName,
    amountDueCents: fields.amountDueCents,
    currency: fields.currency,
    canCharge: methods.length > 0,
    methods: methods.map(toSafeDto),
  };
}
