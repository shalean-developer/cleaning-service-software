import "server-only";

import { formatInvoiceAmount } from "@/features/zoho-invoice-payments/server/formatInvoiceAmount";
import { sanitizeReconcileErrorForDiagnostics } from "@/features/zoho-invoice-payments/server/zohoInvoiceDiagnosticRedaction";
import type { ZohoSalesSyncStatus } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isZohoSalesSyncEnabled } from "./zohoSalesSyncLaunchGuard";
import {
  countZohoSalesSyncByStatus,
  listZohoSalesSyncDiagnostics,
} from "./zohoSalesSyncRepository";

export type ZohoSalesSyncDiagnosticRow = {
  id: string;
  sourceType: string;
  sourceId: string;
  bookingId: string | null;
  bookingReference: string | null;
  invoiceNumber: string | null;
  amountCents: number;
  amountDisplay: string;
  currency: string;
  syncStatus: ZohoSalesSyncStatus;
  syncAttempts: number;
  lastSyncAttemptAt: string | null;
  nextSyncAttemptAt: string | null;
  safeLastError: string | null;
  zohoInvoiceId: string | null;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ZohoSalesSyncDiagnosticsResult = {
  enabled: boolean;
  summary: {
    pending: number;
    synced: number;
    failed: number;
  };
  rows: ZohoSalesSyncDiagnosticRow[];
};

export async function loadZohoSalesSyncDiagnostics(
  filters: { status?: ZohoSalesSyncStatus; limit?: number } = {},
): Promise<ZohoSalesSyncDiagnosticsResult> {
  const client = requireServiceRoleClient();
  const [summary, rows] = await Promise.all([
    countZohoSalesSyncByStatus(client),
    listZohoSalesSyncDiagnostics(filters, client),
  ]);

  return {
    enabled: isZohoSalesSyncEnabled(),
    summary,
    rows: rows.map((row) => ({
      id: row.id,
      sourceType: row.source_type,
      sourceId: row.source_id,
      bookingId: row.booking_id,
      bookingReference: row.booking_id,
      invoiceNumber: row.invoice_number,
      amountCents: row.amount_cents,
      amountDisplay: formatInvoiceAmount(row.amount_cents, row.currency),
      currency: row.currency,
      syncStatus: row.sync_status,
      syncAttempts: row.sync_attempts,
      lastSyncAttemptAt: row.last_sync_attempt_at,
      nextSyncAttemptAt: row.next_sync_attempt_at,
      safeLastError: sanitizeReconcileErrorForDiagnostics(row.last_sync_error),
      zohoInvoiceId: row.zoho_invoice_id,
      syncedAt: row.synced_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}
