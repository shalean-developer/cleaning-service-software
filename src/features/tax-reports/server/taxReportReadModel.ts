import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  loadFinanceReconciliationForExport,
  type FinanceReconciliationItem,
  type FinanceReconciliationSource,
} from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import { getShaleanVatConfig } from "./shaleanVatConfig";
import { logTaxReportEvent } from "./taxReportLogger";
import {
  calculateNetExcludingVat,
  calculateSignedVatForLineItem,
} from "./vatCalculator";

export type TaxReportPeriodType = "monthly" | "quarterly" | "custom";

export type TaxReportSource = FinanceReconciliationSource;

export type TaxReportSummary = {
  periodStart: string;
  periodEnd: string;
  vatRegistered: boolean;
  vatRate: number;
  grossSalesCents: number;
  refundsCreditsCents: number;
  netSalesAfterCreditsCents: number;
  estimatedOutputVatCents: number;
  netExcludingVatCents: number;
  transactionCount: number;
  refundCreditCount: number;
};

export type TaxReportLineItem = {
  id: string;
  source: TaxReportSource;
  reference: string;
  invoiceNumber: string | null;
  bookingId: string | null;
  grossAmountCents: number;
  signedAmountCents: number;
  estimatedVatCents: number;
  netExcludingVatCents: number;
  currency: string;
  paidAt: string | null;
  createdAt: string;
  reconciliationStatus: FinanceReconciliationItem["reconciliationStatus"];
  unresolved: boolean;
};

export type TaxReportSourceBreakdown = {
  source: TaxReportSource;
  grossSalesCents: number;
  refundsCreditsCents: number;
  netSalesCents: number;
  estimatedVatCents: number;
  count: number;
};

export type TaxReportFilters = {
  periodType: TaxReportPeriodType;
  from: string;
  to: string;
  source?: TaxReportSource | "all";
  limit?: number;
  includeUnresolved?: boolean;
};

export type TaxReportResult = {
  summary: TaxReportSummary;
  items: TaxReportLineItem[];
  sourceBreakdown: TaxReportSourceBreakdown[];
  includesUnresolved: boolean;
  hasUnresolvedWarning: boolean;
};

const SALES_SOURCES = new Set<TaxReportSource>([
  "booking",
  "zoho_invoice",
  "saved_card_invoice",
]);

export function isTaxReportEligibleItem(
  item: FinanceReconciliationItem,
  includeUnresolved: boolean,
): boolean {
  if (includeUnresolved) return true;
  return item.reconciliationStatus === "matched";
}

export function mapReconciliationItemToTaxLineItem(
  item: FinanceReconciliationItem,
  vatRegistered: boolean,
  vatRate: number,
): TaxReportLineItem {
  const isRefund = item.source === "refund_credit";
  const signedAmountCents = isRefund ? -item.amountCents : item.amountCents;
  const estimatedVatCents = calculateSignedVatForLineItem(
    signedAmountCents,
    vatRate,
    vatRegistered,
  );
  const netExcludingVatCents = calculateNetExcludingVat(
    signedAmountCents,
    vatRate,
    vatRegistered,
  );

  return {
    id: item.id,
    source: item.source,
    reference: item.reference,
    invoiceNumber: item.invoiceNumber,
    bookingId: item.bookingId,
    grossAmountCents: item.amountCents,
    signedAmountCents,
    estimatedVatCents,
    netExcludingVatCents,
    currency: item.currency,
    paidAt: item.paidAt,
    createdAt: item.createdAt,
    reconciliationStatus: item.reconciliationStatus,
    unresolved: item.reconciliationStatus !== "matched",
  };
}

export function computeTaxReportSummary(
  items: TaxReportLineItem[],
  periodStart: string,
  periodEnd: string,
  vatRegistered: boolean,
  vatRate: number,
): TaxReportSummary {
  let grossSalesCents = 0;
  let refundsCreditsCents = 0;
  let netSalesAfterCreditsCents = 0;
  let estimatedOutputVatCents = 0;
  let netExcludingVatCents = 0;
  let refundCreditCount = 0;

  for (const item of items) {
    if (SALES_SOURCES.has(item.source)) {
      grossSalesCents += item.grossAmountCents;
    } else if (item.source === "refund_credit") {
      refundsCreditsCents += item.grossAmountCents;
      refundCreditCount += 1;
    }

    netSalesAfterCreditsCents += item.signedAmountCents;
    estimatedOutputVatCents += item.estimatedVatCents;
    netExcludingVatCents += item.netExcludingVatCents;
  }

  if (!vatRegistered) {
    estimatedOutputVatCents = 0;
    netExcludingVatCents = netSalesAfterCreditsCents;
  }

  return {
    periodStart,
    periodEnd,
    vatRegistered,
    vatRate,
    grossSalesCents,
    refundsCreditsCents,
    netSalesAfterCreditsCents,
    estimatedOutputVatCents,
    netExcludingVatCents,
    transactionCount: items.length,
    refundCreditCount,
  };
}

export function computeTaxReportSourceBreakdown(
  items: TaxReportLineItem[],
): TaxReportSourceBreakdown[] {
  const bySource = new Map<TaxReportSource, TaxReportSourceBreakdown>();

  for (const item of items) {
    const existing = bySource.get(item.source) ?? {
      source: item.source,
      grossSalesCents: 0,
      refundsCreditsCents: 0,
      netSalesCents: 0,
      estimatedVatCents: 0,
      count: 0,
    };

    if (SALES_SOURCES.has(item.source)) {
      existing.grossSalesCents += item.grossAmountCents;
    } else if (item.source === "refund_credit") {
      existing.refundsCreditsCents += item.grossAmountCents;
    }

    existing.netSalesCents += item.signedAmountCents;
    existing.estimatedVatCents += item.estimatedVatCents;
    existing.count += 1;
    bySource.set(item.source, existing);
  }

  return [...bySource.values()].sort((a, b) => a.source.localeCompare(b.source));
}

function applyItemLimit(items: TaxReportLineItem[], limit?: number): TaxReportLineItem[] {
  const safeLimit = Math.min(Math.max(limit ?? 50, 1), 200);
  return items.slice(0, safeLimit);
}

async function loadTaxReportItems(
  filters: TaxReportFilters,
  client: SupabaseClient<Database>,
): Promise<TaxReportLineItem[]> {
  const vatConfig = getShaleanVatConfig();
  const includeUnresolved = filters.includeUnresolved ?? false;

  const reconciliationItems = await loadFinanceReconciliationForExport(
    {
      from: filters.from,
      to: filters.to,
      source: filters.source ?? "all",
    },
    client,
  );

  return reconciliationItems
    .filter((item) => isTaxReportEligibleItem(item, includeUnresolved))
    .map((item) =>
      mapReconciliationItemToTaxLineItem(
        item,
        vatConfig.vatRegistered,
        vatConfig.vatRate,
      ),
    );
}

export async function loadTaxReport(
  filters: TaxReportFilters,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<TaxReportResult> {
  try {
    const vatConfig = getShaleanVatConfig();
    const includeUnresolved = filters.includeUnresolved ?? false;
    const allItems = await loadTaxReportItems(filters, client);
    const hasUnresolvedWarning =
      includeUnresolved && allItems.some((item) => item.unresolved);

    const summary = computeTaxReportSummary(
      allItems,
      filters.from,
      filters.to,
      vatConfig.vatRegistered,
      vatConfig.vatRate,
    );
    const sourceBreakdown = computeTaxReportSourceBreakdown(allItems);
    const items = applyItemLimit(allItems, filters.limit);

    logTaxReportEvent("tax_report_loaded", {
      itemCount: items.length,
      transactionCount: summary.transactionCount,
      vatRegistered: summary.vatRegistered,
      includesUnresolved: includeUnresolved,
    });

    return {
      summary,
      items,
      sourceBreakdown,
      includesUnresolved: includeUnresolved,
      hasUnresolvedWarning,
    };
  } catch {
    logTaxReportEvent("tax_report_failed", { stage: "load" });
    throw new Error("Could not load tax report data.");
  }
}

export async function loadTaxReportForExport(
  filters: TaxReportFilters,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<TaxReportResult> {
  const vatConfig = getShaleanVatConfig();
  const includeUnresolved = filters.includeUnresolved ?? false;
  const allItems = await loadTaxReportItems(filters, client);
  const hasUnresolvedWarning =
    includeUnresolved && allItems.some((item) => item.unresolved);

  const summary = computeTaxReportSummary(
    allItems,
    filters.from,
    filters.to,
    vatConfig.vatRegistered,
    vatConfig.vatRate,
  );

  return {
    summary,
    items: allItems,
    sourceBreakdown: computeTaxReportSourceBreakdown(allItems),
    includesUnresolved: includeUnresolved,
    hasUnresolvedWarning,
  };
}

/** @internal exported for tests */
export { SALES_SOURCES };
