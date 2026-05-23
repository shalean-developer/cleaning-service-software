import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFinanceReconciliationForExport } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import type { Database, Json } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { buildCustomerRevenueAnalytics } from "./customerRevenueAnalytics";
import {
  computeAverageBookingValue,
  computeEstimatedGrossProfit,
  computeFailedPaymentRate,
  computeMarginPercent,
  computeRepeatCustomerRate,
  countPaidBookings,
  sumRefunds,
  sumSalesRevenue,
} from "./financeAnalyticsCalculations";
import { logFinanceAnalyticsEvent } from "./financeAnalyticsLogger";
import type {
  ExecutiveFinanceSummary,
  FinanceAnalyticsFilters,
  FinanceAnalyticsResult,
} from "./financeAnalyticsTypes";
import { buildOperationalFinanceAnalytics } from "./operationalFinanceAnalytics";
import { buildProfitabilityAnalytics } from "./profitabilityAnalytics";
import { buildRevenueTrendAnalytics } from "./revenueTrendAnalytics";

type BookingSlice = {
  id: string;
  customer_id: string;
  metadata: Json;
};

type PaymentSlice = {
  status: string;
  created_at: string;
  booking_id: string;
  amount_cents: number;
};

type EarningLineSlice = {
  booking_id: string | null;
  payout_amount_cents: number;
};

const STALE_PENDING_DAYS = 7;

function stalePendingCutoff(referenceDate: Date = new Date()): string {
  const cutoff = new Date(referenceDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - STALE_PENDING_DAYS);
  return cutoff.toISOString();
}

async function loadSupportingData(
  client: SupabaseClient<Database>,
  filters: FinanceAnalyticsFilters,
): Promise<{
  earningLines: EarningLineSlice[];
  paymentAttempts: PaymentSlice[];
  bookingById: Map<string, BookingSlice>;
  periodCustomerIds: Set<string>;
  lifetimeCustomerCounts: Array<{ customerId: string; paidBookingCount: number }>;
  lifetimeRevenueByCustomer: Map<string, number>;
  savedCardMethods: Array<{ customer_email: string }>;
  uniqueInvoiceCustomers: number;
  totalBookings: number;
}> {
  const [
    earningLinesResult,
    paymentAttemptsResult,
    periodBookingsResult,
    savedCardMethodsResult,
    invoiceCustomersResult,
    lifetimePaidPaymentsResult,
  ] = await Promise.all([
    client
      .from("earning_lines")
      .select("booking_id, payout_amount_cents")
      .gte("created_at", filters.from)
      .lte("created_at", filters.to),
    client
      .from("payments")
      .select("status, created_at, booking_id, amount_cents")
      .gte("created_at", filters.from)
      .lte("created_at", filters.to),
    client
      .from("bookings")
      .select("id, customer_id, metadata, created_at")
      .gte("created_at", filters.from)
      .lte("created_at", filters.to),
    client
      .from("zoho_invoice_payment_methods")
      .select("customer_email")
      .is("revoked_at", null)
      .limit(500),
    client
      .from("zoho_invoice_payments")
      .select("customer_email")
      .gte("created_at", filters.from)
      .lte("created_at", filters.to)
      .limit(500),
    client
      .from("payments")
      .select("booking_id, amount_cents")
      .eq("status", "paid")
      .lte("created_at", filters.to)
      .limit(500),
  ]);

  if (earningLinesResult.error) throw new Error(earningLinesResult.error.message);
  if (paymentAttemptsResult.error) throw new Error(paymentAttemptsResult.error.message);
  if (periodBookingsResult.error) throw new Error(periodBookingsResult.error.message);
  if (savedCardMethodsResult.error) throw new Error(savedCardMethodsResult.error.message);
  if (invoiceCustomersResult.error) throw new Error(invoiceCustomersResult.error.message);
  if (lifetimePaidPaymentsResult.error) {
    throw new Error(lifetimePaidPaymentsResult.error.message);
  }

  const periodBookings = (periodBookingsResult.data ?? []) as BookingSlice[];
  const bookingById = new Map(periodBookings.map((b) => [b.id, b]));
  const periodCustomerIds = new Set(
    periodBookings.map((b) => b.customer_id).filter(Boolean),
  );

  const lifetimePaidPayments = lifetimePaidPaymentsResult.data ?? [];
  const lifetimeBookingIds = [
    ...new Set(lifetimePaidPayments.map((p) => p.booking_id).filter(Boolean)),
  ];

  const customerBookingCounts = new Map<string, number>();
  const lifetimeRevenueByCustomer = new Map<string, number>();

  if (lifetimeBookingIds.length > 0) {
    const { data: lifetimeBookings, error: lifetimeBookingsError } = await client
      .from("bookings")
      .select("id, customer_id")
      .in("id", lifetimeBookingIds);

    if (lifetimeBookingsError) throw new Error(lifetimeBookingsError.message);

    const customerByBookingId = new Map(
      (lifetimeBookings ?? []).map((b) => [b.id, b.customer_id]),
    );

    for (const payment of lifetimePaidPayments) {
      const customerId = customerByBookingId.get(payment.booking_id);
      if (!customerId) continue;
      customerBookingCounts.set(
        customerId,
        (customerBookingCounts.get(customerId) ?? 0) + 1,
      );
      if (periodCustomerIds.has(customerId)) {
        lifetimeRevenueByCustomer.set(
          customerId,
          (lifetimeRevenueByCustomer.get(customerId) ?? 0) + payment.amount_cents,
        );
      }
    }
  }

  const lifetimeCustomerCounts = [...customerBookingCounts.entries()].map(
    ([customerId, paidBookingCount]) => ({ customerId, paidBookingCount }),
  );

  const invoiceEmails = new Set(
    (invoiceCustomersResult.data ?? []).map((r) => r.customer_email.toLowerCase()),
  );

  return {
    earningLines: (earningLinesResult.data ?? []) as EarningLineSlice[],
    paymentAttempts: (paymentAttemptsResult.data ?? []) as PaymentSlice[],
    bookingById,
    periodCustomerIds,
    lifetimeCustomerCounts,
    lifetimeRevenueByCustomer,
    savedCardMethods: savedCardMethodsResult.data ?? [],
    uniqueInvoiceCustomers: invoiceEmails.size,
    totalBookings: periodBookings.length,
  };
}

export function buildExecutiveSummary(input: {
  items: Awaited<ReturnType<typeof loadFinanceReconciliationForExport>>;
  cleanerPayoutsCents: number;
  totalBookings: number;
  paymentAttempts: PaymentSlice[];
  repeatCustomers: number;
  totalCustomers: number;
}): ExecutiveFinanceSummary {
  const grossRevenueCents = sumSalesRevenue(input.items);
  const refundsCreditsCents = sumRefunds(input.items);
  const netRevenueCents = grossRevenueCents - refundsCreditsCents;
  const paidBookings = countPaidBookings(input.items);
  const estimatedGrossProfitCents = computeEstimatedGrossProfit(
    netRevenueCents,
    input.cleanerPayoutsCents,
  );

  const failedCount = input.paymentAttempts.filter((p) => p.status === "failed").length;

  return {
    grossRevenueCents,
    refundsCreditsCents,
    netRevenueCents,
    cleanerPayoutsCents: input.cleanerPayoutsCents,
    estimatedGrossProfitCents,
    estimatedGrossMarginPercent: computeMarginPercent(
      estimatedGrossProfitCents,
      netRevenueCents,
    ),
    totalBookings: input.totalBookings,
    paidBookings,
    repeatCustomerRatePercent: computeRepeatCustomerRate(
      input.repeatCustomers,
      input.totalCustomers,
    ),
    averageBookingValueCents: computeAverageBookingValue(netRevenueCents, paidBookings),
    failedPaymentRatePercent: computeFailedPaymentRate(
      failedCount,
      input.paymentAttempts.length,
    ),
  };
}

export async function loadFinanceAnalytics(
  filters: FinanceAnalyticsFilters,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<FinanceAnalyticsResult> {
  try {
    const items = await loadFinanceReconciliationForExport(
      { from: filters.from, to: filters.to },
      client,
    );

    const support = await loadSupportingData(client, filters);
    const cleanerPayoutsCents = support.earningLines.reduce(
      (sum, line) => sum + line.payout_amount_cents,
      0,
    );

    const customerInsights = buildCustomerRevenueAnalytics({
      items,
      periodCustomerIds: support.periodCustomerIds,
      lifetimeCustomerCounts: support.lifetimeCustomerCounts,
      lifetimeRevenueByCustomer: support.lifetimeRevenueByCustomer,
      savedCardMethods: support.savedCardMethods,
      uniqueInvoiceCustomers: support.uniqueInvoiceCustomers,
    });

    const executiveSummary = buildExecutiveSummary({
      items,
      cleanerPayoutsCents,
      totalBookings: support.totalBookings,
      paymentAttempts: support.paymentAttempts,
      repeatCustomers: customerInsights.repeatCustomers,
      totalCustomers: customerInsights.totalCustomers,
    });

    const revenueTrends = buildRevenueTrendAnalytics(items, filters.trendGranularity);
    const profitability = buildProfitabilityAnalytics({
      items,
      earningLines: support.earningLines,
      bookingById: support.bookingById,
    });
    const operationalHealth = buildOperationalFinanceAnalytics({
      items,
      paymentAttempts: support.paymentAttempts,
      trendGranularity: filters.trendGranularity,
      stalePendingBeforeIso: stalePendingCutoff(),
    });

    logFinanceAnalyticsEvent("finance_analytics_loaded", {
      periodType: filters.periodType,
      grossRevenueCents: executiveSummary.grossRevenueCents,
      netRevenueCents: executiveSummary.netRevenueCents,
      trendPointCount: revenueTrends.length,
    });

    return {
      executiveSummary,
      revenueTrends,
      profitability,
      customerInsights,
      operationalHealth,
    };
  } catch {
    logFinanceAnalyticsEvent("finance_analytics_failed", { stage: "load" });
    throw new Error("Could not load finance analytics.");
  }
}

export async function loadFinanceAnalyticsForExport(
  filters: FinanceAnalyticsFilters,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<FinanceAnalyticsResult> {
  return loadFinanceAnalytics(filters, client);
}

/** @internal exported for tests */
export { stalePendingCutoff, loadSupportingData };
