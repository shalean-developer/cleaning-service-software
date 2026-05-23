import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  loadFinanceReconciliationForExport,
  type FinanceReconciliationItem,
  type FinanceReconciliationSource,
} from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import { logAccountingCloseEvent } from "./accountingCloseLogger";
import { evaluateAccountingCloseReadiness } from "./accountingCloseReadiness";

export type AccountingClosePeriodType = "weekly" | "monthly" | "custom";

export type AccountingCloseSource = FinanceReconciliationSource;

export type AccountingCloseLineItemStatus =
  | "paid"
  | "pending"
  | "failed"
  | "matched"
  | "mismatch";

export type AccountingCloseReconciliationStatus = "matched" | "pending" | "mismatch" | "failed";

export type AccountingCloseSummary = {
  periodStart: string;
  periodEnd: string;
  grossSalesCents: number;
  refundsCreditsCents: number;
  netSalesCents: number;
  matchedAmountCents: number;
  pendingAmountCents: number;
  mismatchAmountCents: number;
  failedAmountCents: number;
  totalTransactions: number;
  paidTransactions: number;
  failedTransactions: number;
  refundCreditCount: number;
  unresolvedCount: number;
  readyToClose: boolean;
  blockingIssues: string[];
};

export type AccountingCloseLineItem = {
  id: string;
  source: AccountingCloseSource;
  reference: string;
  invoiceNumber: string | null;
  bookingId: string | null;
  amountCents: number;
  currency: string;
  signedAmountCents: number;
  status: AccountingCloseLineItemStatus;
  reconciliationStatus: AccountingCloseReconciliationStatus;
  issueCode: string | null;
  createdAt: string;
  paidAt: string | null;
  syncedAt: string | null;
};

export type AccountingCloseFilters = {
  periodType: AccountingClosePeriodType;
  from: string;
  to: string;
  source?: AccountingCloseSource | "all";
  limit?: number;
};

export type AccountingCloseResult = {
  summary: AccountingCloseSummary;
  items: AccountingCloseLineItem[];
};

const SALES_SOURCES = new Set<AccountingCloseSource>([
  "booking",
  "zoho_invoice",
  "saved_card_invoice",
]);

function mapLineItemStatus(
  reconciliationStatus: AccountingCloseReconciliationStatus,
): AccountingCloseLineItemStatus {
  switch (reconciliationStatus) {
    case "matched":
      return "matched";
    case "mismatch":
      return "mismatch";
    case "failed":
      return "failed";
    case "pending":
      return "pending";
  }
}

export function mapReconciliationItemToCloseLineItem(
  item: FinanceReconciliationItem,
): AccountingCloseLineItem {
  const isRefund = item.source === "refund_credit";
  const signedAmountCents = isRefund ? -item.amountCents : item.amountCents;

  return {
    id: item.id,
    source: item.source,
    reference: item.reference,
    invoiceNumber: item.invoiceNumber,
    bookingId: item.bookingId,
    amountCents: item.amountCents,
    currency: item.currency,
    signedAmountCents,
    status: mapLineItemStatus(item.reconciliationStatus),
    reconciliationStatus: item.reconciliationStatus,
    issueCode: item.issueCode,
    createdAt: item.createdAt,
    paidAt: item.paidAt,
    syncedAt: item.syncedAt,
  };
}

export function computeAccountingCloseSummary(
  items: AccountingCloseLineItem[],
  periodStart: string,
  periodEnd: string,
  now: Date = new Date(),
): AccountingCloseSummary {
  let grossSalesCents = 0;
  let refundsCreditsCents = 0;
  let matchedAmountCents = 0;
  let pendingAmountCents = 0;
  let mismatchAmountCents = 0;
  let failedAmountCents = 0;
  let paidTransactions = 0;
  let failedTransactions = 0;
  let refundCreditCount = 0;
  let unresolvedCount = 0;

  for (const item of items) {
    if (SALES_SOURCES.has(item.source)) {
      grossSalesCents += item.amountCents;
    } else if (item.source === "refund_credit") {
      refundsCreditsCents += item.amountCents;
      refundCreditCount += 1;
    }

    const signed = item.signedAmountCents;

    switch (item.reconciliationStatus) {
      case "matched":
        matchedAmountCents += signed;
        paidTransactions += 1;
        break;
      case "pending":
        pendingAmountCents += signed;
        unresolvedCount += 1;
        break;
      case "mismatch":
        mismatchAmountCents += signed;
        unresolvedCount += 1;
        break;
      case "failed":
        failedAmountCents += signed;
        failedTransactions += 1;
        unresolvedCount += 1;
        break;
    }
  }

  const { readyToClose, blockingIssues } = evaluateAccountingCloseReadiness(items, now);

  return {
    periodStart,
    periodEnd,
    grossSalesCents,
    refundsCreditsCents,
    netSalesCents: grossSalesCents - refundsCreditsCents,
    matchedAmountCents,
    pendingAmountCents,
    mismatchAmountCents,
    failedAmountCents,
    totalTransactions: items.length,
    paidTransactions,
    failedTransactions,
    refundCreditCount,
    unresolvedCount,
    readyToClose,
    blockingIssues,
  };
}

function applyItemLimit(items: AccountingCloseLineItem[], limit?: number): AccountingCloseLineItem[] {
  const safeLimit = Math.min(Math.max(limit ?? 50, 1), 200);
  return items.slice(0, safeLimit);
}

export async function loadAccountingClose(
  filters: AccountingCloseFilters,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AccountingCloseResult> {
  try {
    const reconciliationItems = await loadFinanceReconciliationForExport(
      {
        from: filters.from,
        to: filters.to,
        source: filters.source ?? "all",
      },
      client,
    );

    const closeItems = reconciliationItems.map(mapReconciliationItemToCloseLineItem);
    const summary = computeAccountingCloseSummary(
      closeItems,
      filters.from,
      filters.to,
    );
    const items = applyItemLimit(closeItems, filters.limit);

    logAccountingCloseEvent("accounting_close_loaded", {
      itemCount: items.length,
      totalTransactions: summary.totalTransactions,
      readyToClose: summary.readyToClose,
      unresolvedCount: summary.unresolvedCount,
    });

    return { summary, items };
  } catch {
    logAccountingCloseEvent("accounting_close_failed", { stage: "load" });
    throw new Error("Could not load accounting close data.");
  }
}

export async function loadAccountingCloseForExport(
  filters: AccountingCloseFilters,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<AccountingCloseResult> {
  const reconciliationItems = await loadFinanceReconciliationForExport(
    {
      from: filters.from,
      to: filters.to,
      source: filters.source ?? "all",
    },
    client,
  );

  const closeItems = reconciliationItems.map(mapReconciliationItemToCloseLineItem);
  const summary = computeAccountingCloseSummary(closeItems, filters.from, filters.to);

  return { summary, items: closeItems };
}

/** @internal exported for tests */
export { SALES_SOURCES };
