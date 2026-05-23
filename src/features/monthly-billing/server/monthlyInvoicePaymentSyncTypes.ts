import type { MonthlyInvoiceBatchStatus } from "@/lib/database/types";

export const MONTHLY_INVOICE_PAYMENT_SYNC_SOURCES = [
  "manual",
  "cron",
  "webhook_reconcile",
  "shalean_pay_page",
  "zoho_books",
] as const;

export type MonthlyInvoicePaymentSyncSource =
  (typeof MONTHLY_INVOICE_PAYMENT_SYNC_SOURCES)[number];

export const TERMINAL_BATCH_PAYMENT_STATUSES = new Set<MonthlyInvoiceBatchStatus>([
  "paid",
  "void",
]);

export const SYNCABLE_BATCH_PAYMENT_STATUSES = new Set<MonthlyInvoiceBatchStatus>([
  "generated",
  "sent",
  "overdue",
]);

export type MonthlyInvoicePaymentSyncTargetStatus = Extract<
  MonthlyInvoiceBatchStatus,
  "generated" | "sent" | "overdue" | "paid" | "void"
>;

export type MapZohoInvoiceToBatchPaymentStatusResult =
  | { ok: true; status: MonthlyInvoicePaymentSyncTargetStatus }
  | { ok: false; reason: string };

function normalizeZohoStatus(status: string | null | undefined): string {
  return status?.trim().toLowerCase() ?? "";
}

export function mapZohoInvoiceFieldsToBatchPaymentStatus(input: {
  zohoStatus?: string | null;
  balanceCents: number;
}): MapZohoInvoiceToBatchPaymentStatusResult {
  const zohoStatus = normalizeZohoStatus(input.zohoStatus);

  if (
    zohoStatus === "void" ||
    zohoStatus === "voided" ||
    zohoStatus === "cancelled" ||
    zohoStatus === "canceled"
  ) {
    return { ok: true, status: "void" };
  }

  if (zohoStatus === "paid" || input.balanceCents <= 0) {
    return { ok: true, status: "paid" };
  }

  if (zohoStatus === "overdue") {
    return { ok: true, status: "overdue" };
  }

  if (
    zohoStatus === "sent" ||
    zohoStatus === "open" ||
    zohoStatus === "partially_paid" ||
    zohoStatus === "partially paid"
  ) {
    return { ok: true, status: "sent" };
  }

  if (zohoStatus === "draft") {
    return { ok: true, status: "generated" };
  }

  if (input.balanceCents > 0) {
    return { ok: true, status: "sent" };
  }

  return { ok: false, reason: `Unmapped Zoho invoice status "${zohoStatus}".` };
}

export function isTerminalBatchPaymentStatus(status: MonthlyInvoiceBatchStatus): boolean {
  return TERMINAL_BATCH_PAYMENT_STATUSES.has(status);
}

export function isSyncableBatchPaymentStatus(status: MonthlyInvoiceBatchStatus): boolean {
  return SYNCABLE_BATCH_PAYMENT_STATUSES.has(status);
}

export type BatchPaymentSyncMetadata = {
  lastCheckedAt: string | null;
  lastSource: MonthlyInvoicePaymentSyncSource | null;
  lastError: string | null;
  lastResult: string | null;
};

export function readBatchPaymentSyncMetadata(
  metadata: Record<string, unknown>,
): BatchPaymentSyncMetadata {
  const raw = metadata.paymentSync;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { lastCheckedAt: null, lastSource: null, lastError: null, lastResult: null };
  }
  const record = raw as Record<string, unknown>;
  return {
    lastCheckedAt: typeof record.lastCheckedAt === "string" ? record.lastCheckedAt : null,
    lastSource:
      typeof record.lastSource === "string"
        ? (record.lastSource as MonthlyInvoicePaymentSyncSource)
        : null,
    lastError: typeof record.lastError === "string" ? record.lastError : null,
    lastResult: typeof record.lastResult === "string" ? record.lastResult : null,
  };
}

export function buildBatchPaymentSyncMetadata(
  existing: Record<string, unknown>,
  update: BatchPaymentSyncMetadata,
): Record<string, unknown> {
  return {
    ...existing,
    paymentSync: update,
  };
}
