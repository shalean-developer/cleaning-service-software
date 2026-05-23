import "server-only";

import { formatInvoiceAmount } from "./formatInvoiceAmount";
import { fetchZohoInvoicePaymentDetails } from "./fetchZohoInvoicePaymentDetails";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import type { ZohoInvoicePaymentPublicStatus } from "./types";

export type AdminZohoInvoiceCheckResult =
  | {
      ok: true;
      invoiceNumber: string;
      customerName: string | null;
      amountDueCents: number;
      amountDueDisplay: string;
      currency: string;
      dueDate: string | null;
      status: ZohoInvoicePaymentPublicStatus;
      canPayNow: boolean;
    }
  | {
      ok: false;
      code:
        | "INVALID_INVOICE_NUMBER"
        | "NOT_CONFIGURED"
        | "NOT_FOUND"
        | "ERROR";
      message: string;
      invoiceNumber?: string;
    };

export async function checkZohoInvoiceForAdmin(
  rawInvoiceNumber: string,
): Promise<AdminZohoInvoiceCheckResult> {
  const result = await fetchZohoInvoicePaymentDetails(rawInvoiceNumber);

  if (!result.ok) {
    if ("code" in result && result.code === "INVALID_INVOICE_NUMBER") {
      logZohoInvoicePaymentEvent("zoho_invoice_admin_invoice_check_failed", {
        invoiceNumber: rawInvoiceNumber?.trim() || null,
        failureCode: result.code,
      });
      return {
        ok: false,
        code: "INVALID_INVOICE_NUMBER",
        message: result.message,
      };
    }

    const code =
      "status" in result && result.status === "not_configured"
        ? "NOT_CONFIGURED"
        : "status" in result && result.status === "not_found"
          ? "NOT_FOUND"
          : "ERROR";

    logZohoInvoicePaymentEvent("zoho_invoice_admin_invoice_check_failed", {
      invoiceNumber: "invoiceNumber" in result ? result.invoiceNumber : rawInvoiceNumber?.trim() || null,
      failureCode: code,
      publicStatus: "status" in result ? result.status : null,
    });

    return {
      ok: false,
      code,
      message: result.message,
      invoiceNumber: "invoiceNumber" in result ? result.invoiceNumber : undefined,
    };
  }

  logZohoInvoicePaymentEvent("zoho_invoice_admin_invoice_checked", {
    invoiceNumber: result.invoice.invoiceNumber,
    publicStatus: result.invoice.status,
    balanceCents: result.invoice.amountDueCents,
  });

  return {
    ok: true,
    invoiceNumber: result.invoice.invoiceNumber,
    customerName: result.invoice.customerName,
    amountDueCents: result.invoice.amountDueCents,
    amountDueDisplay: formatInvoiceAmount(
      result.invoice.amountDueCents,
      result.invoice.currency,
    ),
    currency: result.invoice.currency,
    dueDate: result.invoice.dueDate,
    status: result.invoice.status,
    canPayNow: result.invoice.status === "payable",
  };
}
