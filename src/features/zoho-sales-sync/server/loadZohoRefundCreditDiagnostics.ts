import "server-only";

import { formatInvoiceAmount } from "@/features/zoho-invoice-payments/server/formatInvoiceAmount";
import { sanitizeReconcileErrorForDiagnostics } from "@/features/zoho-invoice-payments/server/zohoInvoiceDiagnosticRedaction";
import type { ZohoRefundCreditSyncStatus } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isZohoRefundCreditSyncEnabled } from "./zohoRefundCreditSyncLaunchGuard";
import {
  countZohoRefundCreditDiagnostics,
  listZohoRefundCreditDiagnostics,
} from "./zohoRefundCreditSyncRepository";

export type ZohoRefundCreditDiagnosticRow = {
  id: string;
  sourceType: string;
  sourceId: string;
  bookingId: string | null;
  invoiceNumber: string | null;
  amountCents: number;
  amountDisplay: string;
  currency: string;
  reason: string;
  syncStatus: ZohoRefundCreditSyncStatus;
  syncAttempts: number;
  lastSyncAttemptAt: string | null;
  nextSyncAttemptAt: string | null;
  safeLastError: string | null;
  zohoCreditNoteId: string | null;
  zohoInvoiceId: string | null;
  paystackReference: string | null;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ZohoRefundCreditDiagnosticsResult = {
  enabled: boolean;
  summary: {
    pending: number;
    synced: number;
    failed: number;
  };
  rows: ZohoRefundCreditDiagnosticRow[];
};

export async function loadZohoRefundCreditDiagnostics(
  filters: { status?: ZohoRefundCreditSyncStatus; invoiceNumber?: string; limit?: number } = {},
): Promise<ZohoRefundCreditDiagnosticsResult> {
  const client = requireServiceRoleClient();
  const [summary, rows] = await Promise.all([
    countZohoRefundCreditDiagnostics(client),
    listZohoRefundCreditDiagnostics(filters, client),
  ]);

  return {
    enabled: isZohoRefundCreditSyncEnabled(),
    summary,
    rows: rows.map((row) => ({
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      bookingId: row.booking_id,
      invoiceNumber: row.invoice_number,
      amountCents: row.amount_cents,
      amountDisplay: formatInvoiceAmount(row.amount_cents, row.currency),
      currency: row.currency,
      reason: row.reason,
      syncStatus: row.sync_status,
      syncAttempts: row.sync_attempts,
      lastSyncAttemptAt: row.last_sync_attempt_at,
      nextSyncAttemptAt: row.next_sync_attempt_at,
      safeLastError: sanitizeReconcileErrorForDiagnostics(row.last_sync_error),
      zohoCreditNoteId: row.zoho_credit_note_id,
      zohoInvoiceId: row.zoho_invoice_id,
      paystackReference: row.paystack_reference,
      syncedAt: row.synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}
