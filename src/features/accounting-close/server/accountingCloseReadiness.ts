import "server-only";

import type { AccountingCloseLineItem } from "./accountingCloseReadModel";

export const ACCOUNTING_CLOSE_PENDING_STALE_THRESHOLD_MS = 30 * 60 * 1000;

export type AccountingCloseReadinessResult = {
  readyToClose: boolean;
  blockingIssues: string[];
};

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function evaluateAccountingCloseReadiness(
  items: AccountingCloseLineItem[],
  now: Date = new Date(),
): AccountingCloseReadinessResult {
  const nowMs = now.getTime();
  const blockingIssues: string[] = [];

  const mismatchCount = items.filter((item) => item.reconciliationStatus === "mismatch").length;
  if (mismatchCount > 0) {
    blockingIssues.push(
      pluralize(mismatchCount, "reconciliation mismatch", "reconciliation mismatches"),
    );
  }

  const zohoSyncFailedCount = items.filter((item) => item.issueCode === "ZOHO_SYNC_FAILED").length;
  if (zohoSyncFailedCount > 0) {
    blockingIssues.push(pluralize(zohoSyncFailedCount, "failed Zoho sync", "failed Zoho syncs"));
  }

  const refundCreditFailedCount = items.filter(
    (item) => item.source === "refund_credit" && item.reconciliationStatus === "failed",
  ).length;
  if (refundCreditFailedCount > 0) {
    blockingIssues.push(pluralize(refundCreditFailedCount, "refund credit failed", "refund credits failed"));
  }

  const otherFailedCount = items.filter(
    (item) =>
      item.reconciliationStatus === "failed" &&
      item.issueCode !== "ZOHO_SYNC_FAILED" &&
      item.source !== "refund_credit",
  ).length;
  if (otherFailedCount > 0) {
    blockingIssues.push(
      pluralize(otherFailedCount, "failed transaction", "failed transactions"),
    );
  }

  const stalePendingCount = items.filter((item) => {
    if (item.reconciliationStatus !== "pending") return false;
    const createdMs = new Date(item.createdAt).getTime();
    return Number.isFinite(createdMs) && nowMs - createdMs > ACCOUNTING_CLOSE_PENDING_STALE_THRESHOLD_MS;
  }).length;
  if (stalePendingCount > 0) {
    blockingIssues.push(
      pluralize(stalePendingCount, "pending item older than 30 minutes", "pending items older than 30 minutes"),
    );
  }

  return {
    readyToClose: blockingIssues.length === 0,
    blockingIssues,
  };
}
