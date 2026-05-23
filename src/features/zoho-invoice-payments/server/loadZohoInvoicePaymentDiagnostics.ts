import "server-only";

import type { ZohoInvoicePaymentStatus } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { resolveNotificationAppBaseUrl } from "@/lib/app/appBaseUrl";
import { formatInvoiceAmount } from "./formatInvoiceAmount";
import { buildZohoInvoicePaymentPageUrl } from "./buildZohoInvoicePaymentPageUrl";
import {
  countZohoInvoicePaymentDiagnostics,
  listZohoInvoicePaymentDiagnostics,
  type ZohoInvoicePaymentDiagnosticsFilters,
} from "./zohoInvoicePaymentRepository";
import {
  maskCustomerEmailForDiagnostics,
  sanitizeReconcileErrorForDiagnostics,
} from "./zohoInvoiceDiagnosticRedaction";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";

export type ZohoInvoicePaymentDiagnosticRow = {
  invoiceNumber: string;
  amountCents: number;
  amountDisplay: string;
  currency: string;
  status: ZohoInvoicePaymentStatus;
  reconcileAttempts: number;
  lastReconcileAttemptAt: string | null;
  nextReconcileAttemptAt: string | null;
  safeLastError: string | null;
  maskedCustomerEmail: string | null;
  paymentPageUrl: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
};

export type ZohoInvoicePaymentDiagnosticsSummary = {
  pending_paystack: number;
  paid: number;
  failed: number;
  zoho_reconcile_pending: number;
  zoho_reconcile_failed: number;
};

export type ZohoInvoicePaymentDiagnosticsResult = {
  summary: ZohoInvoicePaymentDiagnosticsSummary;
  payments: ZohoInvoicePaymentDiagnosticRow[];
};

export async function loadZohoInvoicePaymentDiagnostics(
  filters: ZohoInvoicePaymentDiagnosticsFilters = {},
): Promise<ZohoInvoicePaymentDiagnosticsResult> {
  const client = requireServiceRoleClient();
  const [counts, rows] = await Promise.all([
    countZohoInvoicePaymentDiagnostics(client),
    listZohoInvoicePaymentDiagnostics(filters, client),
  ]);

  const appBaseUrl = resolveNotificationAppBaseUrl();

  const result: ZohoInvoicePaymentDiagnosticsResult = {
    summary: {
      pending_paystack: counts.pending_paystack ?? 0,
      paid: counts.paid ?? 0,
      failed: counts.failed ?? 0,
      zoho_reconcile_pending: counts.zoho_reconcile_pending ?? 0,
      zoho_reconcile_failed: counts.zoho_reconcile_failed ?? 0,
    },
    payments: rows.map((row) => ({
      invoiceNumber: row.invoice_number,
      amountCents: row.amount_cents,
      amountDisplay: formatInvoiceAmount(row.amount_cents, row.currency),
      currency: row.currency,
      status: row.status,
      reconcileAttempts: row.reconcile_attempts ?? 0,
      lastReconcileAttemptAt: row.last_reconcile_attempt_at,
      nextReconcileAttemptAt: row.next_reconcile_attempt_at,
      safeLastError: sanitizeReconcileErrorForDiagnostics(row.last_reconcile_error),
      maskedCustomerEmail: maskCustomerEmailForDiagnostics(row.customer_email),
      paymentPageUrl: buildZohoInvoicePaymentPageUrl(appBaseUrl, row.invoice_number),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      paidAt: row.paid_at,
    })),
  };

  logZohoInvoicePaymentEvent("zoho_invoice_diagnostics_loaded", {
    paymentCount: result.payments.length,
    reconcilePending: result.summary.zoho_reconcile_pending,
    reconcileFailed: result.summary.zoho_reconcile_failed,
  });

  return result;
}
