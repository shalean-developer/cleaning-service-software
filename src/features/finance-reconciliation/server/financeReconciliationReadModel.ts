import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { maskCustomerEmailForDiagnostics } from "@/features/zoho-invoice-payments/server/zohoInvoiceDiagnosticRedaction";
import type {
  Database,
  PaymentRow,
  ZohoInvoiceAuthorizationChargeRow,
  ZohoInvoicePaymentRow,
  ZohoRefundCreditSyncRow,
  ZohoSalesSyncRow,
} from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  getFinanceReconciliationIssue,
  type FinanceReconciliationIssueCode,
} from "./financeReconciliationIssueCodes";
import { logFinanceReconciliationEvent } from "./financeReconciliationLogger";

export type FinanceReconciliationSource =
  | "booking"
  | "zoho_invoice"
  | "saved_card_invoice"
  | "refund_credit";

export type FinanceReconciliationStatus = "matched" | "pending" | "mismatch" | "failed";

export type FinanceReconciliationItem = {
  id: string;
  source: FinanceReconciliationSource;
  reference: string;
  bookingId: string | null;
  invoiceNumber: string | null;
  customerLabel: string | null;
  amountCents: number;
  currency: string;
  shaleanStatus: string;
  paystackStatus: string | null;
  zohoStatus: string | null;
  reconciliationStatus: FinanceReconciliationStatus;
  issueCode: string | null;
  issueLabel: string | null;
  createdAt: string;
  paidAt: string | null;
  syncedAt: string | null;
  actionHint: string | null;
};

export type FinanceReconciliationSummary = {
  totalAmountCents: number;
  matchedAmountCents: number;
  pendingAmountCents: number;
  mismatchAmountCents: number;
  failedAmountCents: number;
  matchedCount: number;
  pendingCount: number;
  mismatchCount: number;
  failedCount: number;
  bookingSalesSyncedCount: number;
  manualInvoicePaymentsReconciledCount: number;
  savedCardChargesReconciledCount: number;
  refundsCreditsSyncedCount: number;
  oldestPendingAt: string | null;
  latestFailedAt: string | null;
};

export type FinanceReconciliationFilters = {
  from?: string;
  to?: string;
  source?: FinanceReconciliationSource | "all";
  status?: FinanceReconciliationStatus | "all";
  limit?: number;
  cursor?: string;
};

export type FinanceReconciliationResult = {
  summary: FinanceReconciliationSummary;
  items: FinanceReconciliationItem[];
  nextCursor: string | null;
};

export const FINANCE_RECONCILIATION_DEFAULT_LIMIT = 50;
export const FINANCE_RECONCILIATION_MAX_LIMIT = 200;

type CursorPayload = { createdAt: string; id: string };

function parseCursor(cursor: string | undefined): CursorPayload | null {
  if (!cursor?.trim()) return null;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as CursorPayload;
    if (!parsed.createdAt || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function encodeCursor(item: FinanceReconciliationItem): string {
  return Buffer.from(
    JSON.stringify({ createdAt: item.createdAt, id: item.id }),
    "utf8",
  ).toString("base64url");
}

function itemSortKey(item: FinanceReconciliationItem): number {
  return new Date(item.createdAt).getTime();
}

function inDateRange(isoDate: string, from?: string, to?: string): boolean {
  const ts = new Date(isoDate).getTime();
  if (from) {
    const fromTs = new Date(from).getTime();
    if (!Number.isNaN(fromTs) && ts < fromTs) return false;
  }
  if (to) {
    const toTs = new Date(to).getTime();
    if (!Number.isNaN(toTs) && ts > toTs) return false;
  }
  return true;
}

function mapPaystackFromPaymentStatus(status: PaymentRow["status"]): string | null {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
    case "initialized":
      return "pending";
    case "failed":
      return "failed";
    case "refunded":
      return "refunded";
    default:
      return null;
  }
}

function resolveIssue(issueCode: FinanceReconciliationIssueCode | null) {
  const issue = getFinanceReconciliationIssue(issueCode);
  return {
    issueCode,
    issueLabel: issue?.label ?? null,
    actionHint: issue?.actionHint ?? null,
  };
}

function buildBookingItems(
  payments: PaymentRow[],
  salesSyncByBookingId: Map<string, ZohoSalesSyncRow>,
): FinanceReconciliationItem[] {
  return payments.map((payment) => {
    const salesSync = salesSyncByBookingId.get(payment.booking_id) ?? null;
    const reference = payment.provider_ref?.trim() || payment.id;
    const paystackStatus = mapPaystackFromPaymentStatus(payment.status);

    let reconciliationStatus: FinanceReconciliationStatus = "pending";
    let issueCode: FinanceReconciliationIssueCode | null = "ZOHO_SYNC_PENDING";
    let zohoStatus: string | null = salesSync?.sync_status ?? null;

    if (payment.status === "failed") {
      reconciliationStatus = "failed";
      issueCode = "PAYSTACK_FAILED";
    } else if (payment.status === "pending" || payment.status === "initialized") {
      reconciliationStatus = "pending";
      issueCode = "PAYSTACK_PENDING";
    } else if (!salesSync) {
      reconciliationStatus = "mismatch";
      issueCode = "MISSING_ZOHO_SYNC";
    } else if (salesSync.sync_status === "pending") {
      reconciliationStatus = "pending";
      issueCode = "ZOHO_SYNC_PENDING";
    } else if (salesSync.sync_status === "failed") {
      reconciliationStatus = "failed";
      issueCode = "ZOHO_SYNC_FAILED";
    } else if (
      salesSync.amount_cents !== payment.amount_cents ||
      salesSync.currency !== payment.currency
    ) {
      reconciliationStatus = "mismatch";
      issueCode = "AMOUNT_MISMATCH";
    } else if (salesSync.zoho_invoice_id && salesSync.zoho_payment_id) {
      reconciliationStatus = "matched";
      issueCode = "MATCHED";
      zohoStatus = "synced";
    } else {
      reconciliationStatus = "mismatch";
      issueCode = "MISSING_ZOHO_PAYMENT_ID";
    }

    const issue = resolveIssue(issueCode);

    return {
      id: `booking:${payment.id}`,
      source: "booking" as const,
      reference,
      bookingId: payment.booking_id,
      invoiceNumber: salesSync?.invoice_number ?? null,
      customerLabel: `Booking ${payment.booking_id.slice(0, 8)}`,
      amountCents: payment.amount_cents,
      currency: payment.currency,
      shaleanStatus: payment.status,
      paystackStatus,
      zohoStatus,
      reconciliationStatus,
      issueCode: issue.issueCode,
      issueLabel: issue.issueLabel,
      createdAt: payment.created_at,
      paidAt: payment.status === "paid" ? payment.updated_at : null,
      syncedAt: salesSync?.synced_at ?? null,
      actionHint: issue.actionHint,
    };
  });
}

function buildZohoInvoiceItems(rows: ZohoInvoicePaymentRow[]): FinanceReconciliationItem[] {
  return rows.map((row) => {
    let reconciliationStatus: FinanceReconciliationStatus = "pending";
    let issueCode: FinanceReconciliationIssueCode | null = "PAYSTACK_PENDING";

    if (row.status === "failed" || row.status === "cancelled") {
      reconciliationStatus = "failed";
      issueCode = "PAYSTACK_FAILED";
    } else if (row.status === "pending_paystack" || row.status === "initialized") {
      reconciliationStatus = "pending";
      issueCode = "PAYSTACK_PENDING";
    } else if (row.status === "zoho_reconcile_pending") {
      reconciliationStatus = "pending";
      issueCode = "ZOHO_SYNC_PENDING";
    } else if (row.status === "zoho_reconcile_failed") {
      reconciliationStatus = "failed";
      issueCode = "ZOHO_SYNC_FAILED";
    } else if (row.status === "paid" && row.zoho_payment_id) {
      reconciliationStatus = "matched";
      issueCode = "MATCHED";
    } else if (row.status === "paid" && !row.zoho_payment_id) {
      reconciliationStatus = "mismatch";
      issueCode = "MISSING_ZOHO_PAYMENT_ID";
    }

    const issue = resolveIssue(issueCode);
    const customerLabel =
      row.customer_name?.trim() ||
      maskCustomerEmailForDiagnostics(row.customer_email) ||
      null;

    return {
      id: `zoho_invoice:${row.id}`,
      source: "zoho_invoice" as const,
      reference: row.paystack_reference?.trim() || row.invoice_number,
      bookingId: null,
      invoiceNumber: row.invoice_number,
      customerLabel,
      amountCents: row.amount_cents,
      currency: row.currency,
      shaleanStatus: row.status,
      paystackStatus: row.paystack_status,
      zohoStatus: row.zoho_payment_id ? row.zoho_status ?? "recorded" : row.zoho_status,
      reconciliationStatus,
      issueCode: issue.issueCode,
      issueLabel: issue.issueLabel,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      syncedAt: row.zoho_payment_id ? row.paid_at ?? row.created_at : null,
      actionHint: issue.actionHint,
    };
  });
}

function buildSavedCardItems(rows: ZohoInvoiceAuthorizationChargeRow[]): FinanceReconciliationItem[] {
  return rows.map((row) => {
    let reconciliationStatus: FinanceReconciliationStatus = "pending";
    let issueCode: FinanceReconciliationIssueCode | null = "PAYSTACK_PENDING";

    if (row.status === "failed") {
      reconciliationStatus = "failed";
      issueCode = "PAYSTACK_FAILED";
    } else if (
      row.status === "initialized" ||
      row.status === "submitted" ||
      row.status === "pending_webhook"
    ) {
      reconciliationStatus = "pending";
      issueCode = "PAYSTACK_PENDING";
    } else if (row.status === "zoho_reconcile_pending") {
      reconciliationStatus = "pending";
      issueCode = "ZOHO_SYNC_PENDING";
    } else if (row.status === "zoho_reconcile_failed") {
      reconciliationStatus = "failed";
      issueCode = "ZOHO_SYNC_FAILED";
    } else if (row.status === "paid" && row.zoho_payment_id) {
      reconciliationStatus = "matched";
      issueCode = "MATCHED";
    } else if (row.status === "paid" && !row.zoho_payment_id) {
      reconciliationStatus = "mismatch";
      issueCode = "MISSING_ZOHO_PAYMENT_ID";
    }

    const issue = resolveIssue(issueCode);

    return {
      id: `saved_card:${row.id}`,
      source: "saved_card_invoice" as const,
      reference: row.paystack_reference?.trim() || row.invoice_number,
      bookingId: null,
      invoiceNumber: row.invoice_number,
      customerLabel: maskCustomerEmailForDiagnostics(row.customer_email),
      amountCents: row.amount_cents,
      currency: row.currency,
      shaleanStatus: row.status,
      paystackStatus: row.paystack_status,
      zohoStatus: row.zoho_payment_id ? row.zoho_status ?? "recorded" : row.zoho_status,
      reconciliationStatus,
      issueCode: issue.issueCode,
      issueLabel: issue.issueLabel,
      createdAt: row.created_at,
      paidAt: row.paid_at,
      syncedAt: row.zoho_payment_id ? row.paid_at ?? row.created_at : null,
      actionHint: issue.actionHint,
    };
  });
}

function buildRefundCreditItems(rows: ZohoRefundCreditSyncRow[]): FinanceReconciliationItem[] {
  return rows.map((row) => {
    let reconciliationStatus: FinanceReconciliationStatus = "pending";
    let issueCode: FinanceReconciliationIssueCode | null = "CREDIT_NOTE_PENDING";

    if (row.sync_status === "failed") {
      reconciliationStatus = "failed";
      issueCode = "CREDIT_NOTE_FAILED";
    } else if (row.sync_status === "pending") {
      reconciliationStatus = "pending";
      issueCode = "CREDIT_NOTE_PENDING";
    } else if (row.sync_status === "synced" && row.zoho_credit_note_id) {
      reconciliationStatus = "matched";
      issueCode = "MATCHED";
    } else if (row.sync_status === "synced" && !row.zoho_credit_note_id) {
      reconciliationStatus = "mismatch";
      issueCode = "CREDIT_NOTE_MISSING_ID";
    }

    const issue = resolveIssue(issueCode);

    return {
      id: `refund_credit:${row.id}`,
      source: "refund_credit" as const,
      reference: row.paystack_reference?.trim() || row.source_id.slice(0, 8),
      bookingId: row.booking_id,
      invoiceNumber: row.invoice_number,
      customerLabel: row.invoice_number
        ? `Invoice ${row.invoice_number}`
        : row.booking_id
          ? `Booking ${row.booking_id.slice(0, 8)}`
          : null,
      amountCents: row.amount_cents,
      currency: row.currency,
      shaleanStatus: row.sync_status,
      paystackStatus: row.paystack_reference ? "refunded" : null,
      zohoStatus: row.zoho_credit_note_id ? "credit_note" : null,
      reconciliationStatus,
      issueCode: issue.issueCode,
      issueLabel: issue.issueLabel,
      createdAt: row.created_at,
      paidAt: null,
      syncedAt: row.synced_at,
      actionHint: issue.actionHint,
    };
  });
}

function computeSummary(items: FinanceReconciliationItem[]): FinanceReconciliationSummary {
  const summary: FinanceReconciliationSummary = {
    totalAmountCents: 0,
    matchedAmountCents: 0,
    pendingAmountCents: 0,
    mismatchAmountCents: 0,
    failedAmountCents: 0,
    matchedCount: 0,
    pendingCount: 0,
    mismatchCount: 0,
    failedCount: 0,
    bookingSalesSyncedCount: 0,
    manualInvoicePaymentsReconciledCount: 0,
    savedCardChargesReconciledCount: 0,
    refundsCreditsSyncedCount: 0,
    oldestPendingAt: null,
    latestFailedAt: null,
  };

  for (const item of items) {
    summary.totalAmountCents += item.amountCents;

    switch (item.reconciliationStatus) {
      case "matched":
        summary.matchedAmountCents += item.amountCents;
        summary.matchedCount += 1;
        break;
      case "pending":
        summary.pendingAmountCents += item.amountCents;
        summary.pendingCount += 1;
        if (
          !summary.oldestPendingAt ||
          new Date(item.createdAt) < new Date(summary.oldestPendingAt)
        ) {
          summary.oldestPendingAt = item.createdAt;
        }
        break;
      case "mismatch":
        summary.mismatchAmountCents += item.amountCents;
        summary.mismatchCount += 1;
        break;
      case "failed":
        summary.failedAmountCents += item.amountCents;
        summary.failedCount += 1;
        if (
          !summary.latestFailedAt ||
          new Date(item.createdAt) > new Date(summary.latestFailedAt)
        ) {
          summary.latestFailedAt = item.createdAt;
        }
        break;
    }

    if (item.source === "booking" && item.reconciliationStatus === "matched") {
      summary.bookingSalesSyncedCount += 1;
    }
    if (item.source === "zoho_invoice" && item.reconciliationStatus === "matched") {
      summary.manualInvoicePaymentsReconciledCount += 1;
    }
    if (item.source === "saved_card_invoice" && item.reconciliationStatus === "matched") {
      summary.savedCardChargesReconciledCount += 1;
    }
    if (item.source === "refund_credit" && item.reconciliationStatus === "matched") {
      summary.refundsCreditsSyncedCount += 1;
    }
  }

  return summary;
}

function applyFilters(
  items: FinanceReconciliationItem[],
  filters: FinanceReconciliationFilters,
): FinanceReconciliationItem[] {
  return items.filter((item) => {
    const effectiveDate = item.paidAt ?? item.createdAt;
    if (!inDateRange(effectiveDate, filters.from, filters.to)) return false;
    if (filters.source && filters.source !== "all" && item.source !== filters.source) {
      return false;
    }
    if (filters.status && filters.status !== "all" && item.reconciliationStatus !== filters.status) {
      return false;
    }
    return true;
  });
}

function paginateItems(
  items: FinanceReconciliationItem[],
  filters: FinanceReconciliationFilters,
): { pageItems: FinanceReconciliationItem[]; nextCursor: string | null } {
  const limit = Math.min(
    Math.max(filters.limit ?? FINANCE_RECONCILIATION_DEFAULT_LIMIT, 1),
    FINANCE_RECONCILIATION_MAX_LIMIT,
  );

  const cursor = parseCursor(filters.cursor);
  let startIndex = 0;

  if (cursor) {
    startIndex = items.findIndex(
      (item) =>
        item.createdAt < cursor.createdAt ||
        (item.createdAt === cursor.createdAt && item.id < cursor.id),
    );
    if (startIndex < 0) startIndex = items.length;
  }

  const pageItems = items.slice(startIndex, startIndex + limit);
  const nextCursor =
    startIndex + limit < items.length && pageItems.length > 0
      ? encodeCursor(pageItems[pageItems.length - 1]!)
      : null;

  return { pageItems, nextCursor };
}

async function loadAllReconciliationItems(
  client: SupabaseClient<Database>,
  from?: string,
  to?: string,
): Promise<FinanceReconciliationItem[]> {
  let paymentsQuery = client
    .from("payments")
    .select("*")
    .in("status", ["paid", "refunded", "pending", "failed", "initialized"])
    .order("created_at", { ascending: false });

  if (from) paymentsQuery = paymentsQuery.gte("created_at", from);
  if (to) paymentsQuery = paymentsQuery.lte("created_at", to);

  const [
    paymentsResult,
    salesSyncResult,
    invoicePaymentsResult,
    authChargesResult,
    refundCreditsResult,
  ] = await Promise.all([
    paymentsQuery.limit(500),
    client.from("zoho_sales_sync").select("*").eq("source_type", "booking").limit(500),
    client
      .from("zoho_invoice_payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    client
      .from("zoho_invoice_authorization_charges")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    client
      .from("zoho_refund_credit_sync")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (paymentsResult.error) throw new Error(paymentsResult.error.message);
  if (salesSyncResult.error) throw new Error(salesSyncResult.error.message);
  if (invoicePaymentsResult.error) throw new Error(invoicePaymentsResult.error.message);
  if (authChargesResult.error) throw new Error(authChargesResult.error.message);
  if (refundCreditsResult.error) throw new Error(refundCreditsResult.error.message);

  const salesSyncByBookingId = new Map<string, ZohoSalesSyncRow>();
  for (const row of salesSyncResult.data ?? []) {
    if (row.booking_id) salesSyncByBookingId.set(row.booking_id, row);
    if (row.source_type === "booking") salesSyncByBookingId.set(row.source_id, row);
  }

  const items = [
    ...buildBookingItems(paymentsResult.data ?? [], salesSyncByBookingId),
    ...buildZohoInvoiceItems(invoicePaymentsResult.data ?? []),
    ...buildSavedCardItems(authChargesResult.data ?? []),
    ...buildRefundCreditItems(refundCreditsResult.data ?? []),
  ];

  return items.sort((a, b) => {
    const diff = itemSortKey(b) - itemSortKey(a);
    if (diff !== 0) return diff;
    return b.id.localeCompare(a.id);
  });
}

export async function loadFinanceReconciliation(
  filters: FinanceReconciliationFilters = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<FinanceReconciliationResult> {
  try {
    const allItems = await loadAllReconciliationItems(client, filters.from, filters.to);
    const filtered = applyFilters(allItems, filters);
    const summary = computeSummary(filtered);
    const { pageItems, nextCursor } = paginateItems(filtered, filters);

    logFinanceReconciliationEvent("finance_reconciliation_loaded", {
      itemCount: pageItems.length,
      matchedCount: summary.matchedCount,
      pendingCount: summary.pendingCount,
      mismatchCount: summary.mismatchCount,
      failedCount: summary.failedCount,
    });

    return { summary, items: pageItems, nextCursor };
  } catch {
    logFinanceReconciliationEvent("finance_reconciliation_failed", { stage: "load" });
    throw new Error("Could not load finance reconciliation data.");
  }
}

export async function loadFinanceReconciliationForExport(
  filters: FinanceReconciliationFilters = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<FinanceReconciliationItem[]> {
  const allItems = await loadAllReconciliationItems(client, filters.from, filters.to);
  return applyFilters(allItems, filters);
}

/** @internal exported for tests */
export {
  buildBookingItems,
  buildZohoInvoiceItems,
  buildSavedCardItems,
  buildRefundCreditItems,
  computeSummary,
};
