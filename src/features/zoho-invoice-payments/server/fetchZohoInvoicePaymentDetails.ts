import "server-only";

import {
  buildSafeInvoiceFieldsFromZoho,
  getZohoInvoiceByNumber,
  zohoAmountToCents,
} from "@/lib/zoho/invoices";
import { isZohoBooksEnabled } from "@/lib/zoho/zohoEnv";
import { isZohoApiError, isZohoConfigError } from "@/lib/zoho/zohoClient";
import { validateAndNormalizeInvoiceNumber } from "./invoiceNumberValidation";
import { mapZohoInvoiceToPublicStatus } from "./mapZohoInvoiceToPublicStatus";
import type { FetchZohoInvoicePaymentDetailsResult } from "./types";
import { measureZohoInvoiceFetch } from "./zohoInvoiceFetchTiming";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import { publicMessageForZohoInvoiceStatus } from "./zohoInvoicePublicMessages";
import { requireZohoInvoicePaymentsEnabled } from "./zohoPaymentLaunchGuard";

/**
 * Resolves public-safe invoice payment details for API routes and /pay pages.
 * Amounts always originate from Zoho (never from the client).
 */
export async function fetchZohoInvoicePaymentDetails(
  rawInvoiceNumber: string,
): Promise<FetchZohoInvoicePaymentDetailsResult> {
  const validated = validateAndNormalizeInvoiceNumber(rawInvoiceNumber);
  if (!validated.ok) {
    logZohoInvoicePaymentEvent("invoice_number_invalid", {
      invoiceNumber: rawInvoiceNumber?.trim() || null,
      reason: validated.message,
    });
    return validated;
  }

  const { normalized } = validated;

  const invoicePaymentsGate = requireZohoInvoicePaymentsEnabled();
  if (!invoicePaymentsGate.ok) {
    logZohoInvoicePaymentEvent("zoho_invoice_payments_feature_disabled", {
      invoiceNumber: normalized,
      reason: "fetch_details",
    });
    return {
      ok: false,
      status: "not_configured",
      message: invoicePaymentsGate.message,
      invoiceNumber: normalized,
    };
  }

  if (!isZohoBooksEnabled()) {
    logZohoInvoicePaymentEvent("zoho_not_configured", {
      invoiceNumber: normalized,
      reason: "zoho_books_disabled_or_env_missing",
    });
    return {
      ok: false,
      status: "not_configured",
      message: publicMessageForZohoInvoiceStatus("not_configured"),
      invoiceNumber: normalized,
    };
  }

  logZohoInvoicePaymentEvent("zoho_invoice_fetch_started", {
    invoiceNumber: normalized,
    operation: "fetch_invoice_by_number",
  });

  try {
    const { result: lookup, timing } = await measureZohoInvoiceFetch(() =>
      getZohoInvoiceByNumber(normalized),
    );

    if (timing.exceededLatencyWarning) {
      logZohoInvoicePaymentEvent("zoho_api_latency_warning", {
        invoiceNumber: normalized,
        durationMs: timing.durationMs,
        operation: "fetch_invoice_by_number",
      });
    }

    if (!lookup.ok) {
      if (lookup.code === "NOT_FOUND") {
        logZohoInvoicePaymentEvent("zoho_invoice_not_found", {
          invoiceNumber: normalized,
          durationMs: timing.durationMs,
        });
        return {
          ok: false,
          status: "not_found",
          message: publicMessageForZohoInvoiceStatus("not_found"),
          invoiceNumber: normalized,
        };
      }

      logZohoInvoicePaymentEvent("zoho_invoice_fetch_failed", {
        invoiceNumber: normalized,
        durationMs: timing.durationMs,
        failureCode: lookup.code,
        retryable: lookup.retryable,
      });
      return {
        ok: false,
        status: "error",
        message: publicMessageForZohoInvoiceStatus("error"),
        invoiceNumber: normalized,
      };
    }

    const fields = buildSafeInvoiceFieldsFromZoho(lookup.invoice);
    const balanceCents = fields.amountDueCents;
    const invoiceTotalCents = zohoAmountToCents(lookup.invoice.total);
    const publicStatus = mapZohoInvoiceToPublicStatus({
      zohoStatus: lookup.invoice.status,
      balanceCents,
      invoiceTotalCents,
    });

    logZohoInvoicePaymentEvent("zoho_invoice_status_mapped", {
      invoiceNumber: normalized,
      zohoStatus: lookup.invoice.status ?? null,
      balanceCents,
      invoiceTotalCents,
      publicStatus,
      durationMs: timing.durationMs,
    });

    logZohoInvoicePaymentEvent("zoho_invoice_fetch_succeeded", {
      invoiceNumber: normalized,
      publicStatus,
      durationMs: timing.durationMs,
      operation: "fetch_invoice_by_number",
    });

    if (
      publicStatus === "not_configured" ||
      publicStatus === "not_found" ||
      publicStatus === "error"
    ) {
      return {
        ok: false,
        status: publicStatus,
        message: publicMessageForZohoInvoiceStatus(publicStatus),
        invoiceNumber: normalized,
      };
    }

    return {
      ok: true,
      invoice: {
        invoiceNumber: fields.invoiceNumber,
        customerName: fields.customerName,
        amountDueCents: fields.amountDueCents,
        currency: fields.currency,
        dueDate: fields.dueDate,
        lineItems: fields.lineItems,
        status: publicStatus,
      },
    };
  } catch (error) {
    if (isZohoConfigError(error)) {
      logZohoInvoicePaymentEvent("zoho_not_configured", {
        invoiceNumber: normalized,
        reason: error.code,
      });
      return {
        ok: false,
        status: "not_configured",
        message: publicMessageForZohoInvoiceStatus("not_configured"),
        invoiceNumber: normalized,
      };
    }

    const internalCode = isZohoApiError(error) ? error.code : "UNEXPECTED_ERROR";
    const internalStatusCode = isZohoApiError(error) ? error.statusCode : null;

    logZohoInvoicePaymentEvent("zoho_invoice_fetch_failed", {
      invoiceNumber: normalized,
      failureCode: internalCode,
      httpStatus: internalStatusCode,
      retryable: isZohoApiError(error),
    });

    return {
      ok: false,
      status: "error",
      message: publicMessageForZohoInvoiceStatus("error"),
      invoiceNumber: normalized,
    };
  }
}
