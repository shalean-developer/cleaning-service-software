import "server-only";

import type { FinanceReconciliationSource } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";

export type FinanceAnalyticsPeriodType = "weekly" | "monthly" | "quarterly" | "custom";

export type RevenueTrendGranularity = "daily" | "weekly" | "monthly";

export type ExecutiveFinanceSummary = {
  grossRevenueCents: number;
  refundsCreditsCents: number;
  netRevenueCents: number;
  cleanerPayoutsCents: number;
  estimatedGrossProfitCents: number;
  estimatedGrossMarginPercent: number;
  totalBookings: number;
  paidBookings: number;
  repeatCustomerRatePercent: number;
  averageBookingValueCents: number;
  failedPaymentRatePercent: number;
};

export type RevenueTrendPoint = {
  period: string;
  grossRevenueCents: number;
  netRevenueCents: number;
  refundsCreditsCents: number;
  bookingCount: number;
  savedCardChargesCents: number;
  corporateRevenueCents: number;
  residentialRevenueCents: number;
};

export type ServiceProfitabilityRow = {
  serviceType: string;
  serviceLabel: string;
  revenueCents: number;
  estimatedPayoutCents: number;
  estimatedMarginPercent: number | null;
};

export type ProfitabilityAnalytics = {
  cleanerPayoutsCents: number;
  payoutRatioPercent: number;
  estimatedGrossProfitCents: number;
  estimatedMarginPercent: number;
  revenueByServiceType: ServiceProfitabilityRow[];
  revenueByCustomerType: {
    corporateCents: number;
    residentialCents: number;
  };
  topProfitableServices: ServiceProfitabilityRow[];
  lowestMarginServices: ServiceProfitabilityRow[];
};

export type TopCustomerRow = {
  customerLabel: string;
  revenueCents: number;
  transactionCount: number;
};

export type CustomerRevenueInsights = {
  repeatCustomerRatePercent: number;
  totalCustomers: number;
  repeatCustomers: number;
  topCustomersByRevenue: TopCustomerRow[];
  corporateVsResidential: {
    corporateCents: number;
    residentialCents: number;
    corporatePercent: number;
  };
  averageLifetimeRevenueCents: number;
  paymentMethodUsage: {
    bookingCheckout: number;
    invoiceCheckout: number;
    savedCard: number;
  };
  savedCardAdoptionRatePercent: number;
  invoiceVsBookingRevenueSplit: {
    invoiceCents: number;
    bookingCents: number;
  };
};

export type SyncHealthCounts = {
  matched: number;
  pending: number;
  failed: number;
  mismatch: number;
};

export type OperationalFinanceHealth = {
  failedPaymentCount: number;
  failedPaymentRatePercent: number;
  refundRatePercent: number;
  reconciliationFailureCount: number;
  stalePendingFinanceItems: number;
  savedCardChargeSuccessRatePercent: number;
  savedCardChargeAttempts: number;
  zohoSyncHealth: SyncHealthCounts;
  refundCreditSyncHealth: SyncHealthCounts;
  failedPaymentTrend: Array<{ period: string; failedCount: number; totalAttempts: number }>;
  refundTrend: Array<{ period: string; refundCents: number; refundCount: number }>;
};

export type FinanceAnalyticsFilters = {
  periodType: FinanceAnalyticsPeriodType;
  from: string;
  to: string;
  trendGranularity: RevenueTrendGranularity;
};

export type FinanceAnalyticsResult = {
  executiveSummary: ExecutiveFinanceSummary;
  revenueTrends: RevenueTrendPoint[];
  profitability: ProfitabilityAnalytics;
  customerInsights: CustomerRevenueInsights;
  operationalHealth: OperationalFinanceHealth;
};

export const SALES_SOURCES = new Set<FinanceReconciliationSource>([
  "booking",
  "zoho_invoice",
  "saved_card_invoice",
]);

export const CORPORATE_SOURCES = new Set<FinanceReconciliationSource>([
  "zoho_invoice",
  "saved_card_invoice",
]);

export const RESIDENTIAL_SOURCES = new Set<FinanceReconciliationSource>(["booking"]);
