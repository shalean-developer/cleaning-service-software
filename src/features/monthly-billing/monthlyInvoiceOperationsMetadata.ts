import type { MonthlyInvoiceBatchStatus } from "@/lib/database/types";

export type MonthlyInvoiceOperationsMetadata = {
  dueDate: string | null;
  paymentLink: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  lastSentAt: string | null;
};

const OPERATIONS_KEY = "invoiceOperations";

function readOperationsRoot(metadata: Record<string, unknown>): Record<string, unknown> {
  const root = metadata[OPERATIONS_KEY];
  if (root == null || typeof root !== "object" || Array.isArray(root)) {
    return {};
  }
  return root as Record<string, unknown>;
}

export function readMonthlyInvoiceOperationsMetadata(
  metadata: Record<string, unknown>,
): MonthlyInvoiceOperationsMetadata {
  const ops = readOperationsRoot(metadata);
  const reminderCountRaw = ops.reminderCount;
  const reminderCount =
    typeof reminderCountRaw === "number" && Number.isFinite(reminderCountRaw)
      ? Math.max(0, Math.floor(reminderCountRaw))
      : 0;

  return {
    dueDate: typeof ops.dueDate === "string" && ops.dueDate.trim() ? ops.dueDate.trim() : null,
    paymentLink:
      typeof ops.paymentLink === "string" && ops.paymentLink.trim() ? ops.paymentLink.trim() : null,
    reminderCount,
    lastReminderAt:
      typeof ops.lastReminderAt === "string" && ops.lastReminderAt.trim()
        ? ops.lastReminderAt.trim()
        : null,
    lastSentAt:
      typeof ops.lastSentAt === "string" && ops.lastSentAt.trim() ? ops.lastSentAt.trim() : null,
  };
}

export function buildMonthlyInvoiceOperationsMetadata(
  existingMetadata: Record<string, unknown>,
  patch: Partial<MonthlyInvoiceOperationsMetadata>,
): Record<string, unknown> {
  const current = readMonthlyInvoiceOperationsMetadata(existingMetadata);
  const merged: MonthlyInvoiceOperationsMetadata = {
    dueDate: patch.dueDate !== undefined ? patch.dueDate : current.dueDate,
    paymentLink: patch.paymentLink !== undefined ? patch.paymentLink : current.paymentLink,
    reminderCount:
      patch.reminderCount !== undefined ? patch.reminderCount : current.reminderCount,
    lastReminderAt:
      patch.lastReminderAt !== undefined ? patch.lastReminderAt : current.lastReminderAt,
    lastSentAt: patch.lastSentAt !== undefined ? patch.lastSentAt : current.lastSentAt,
  };

  return {
    ...existingMetadata,
    [OPERATIONS_KEY]: merged,
  };
}

export function isSendableBatchStatus(status: MonthlyInvoiceBatchStatus): boolean {
  return status === "generated";
}

export function isReminderEligibleBatchStatus(status: MonthlyInvoiceBatchStatus): boolean {
  return status === "sent" || status === "overdue";
}

export function isOverdueEligibleBatchStatus(status: MonthlyInvoiceBatchStatus): boolean {
  return status === "generated" || status === "sent";
}

export function isTerminalInvoiceOperationsStatus(status: MonthlyInvoiceBatchStatus): boolean {
  return status === "paid" || status === "void";
}

export function isDueDatePast(dueDate: string, now = new Date()): boolean {
  const endOfDueDay = new Date(`${dueDate.trim()}T23:59:59.999Z`);
  if (Number.isNaN(endOfDueDay.getTime())) return false;
  return now.getTime() > endOfDueDay.getTime();
}

export function formatBillingMonthLabel(billingMonth: string): string {
  const match = billingMonth.match(/^(\d{4})-(\d{2})$/);
  if (!match) return billingMonth;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return billingMonth;
  }
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-ZA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
