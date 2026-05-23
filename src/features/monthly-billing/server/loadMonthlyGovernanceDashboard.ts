import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isZohoMonthlyCreditGovernanceEnabled } from "@/lib/app/zohoMonthlyCreditGovernanceFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isMonthlyAccountOverrideActive } from "./customerBillingAccountMapping";
import { listCustomerBillingAccounts } from "./customerBillingAccountRepository";
import { loadMonthlyAccountExposureForCustomer } from "./loadMonthlyAccountExposure";
import {
  computeMonthlyAccountRiskScore,
  type MonthlyAccountRiskRecommendation,
} from "./computeMonthlyAccountRiskScore";
import { readMonthlyInvoiceDeliveryMetadata } from "./monthlyInvoiceDeliveryTypes";
import { listMonthlyInvoiceBatches } from "./monthlyInvoiceBatchRepository";
import { loadMonthlyCollectionsDashboard } from "./loadMonthlyCollectionsDashboard";
import type { MonthlyAccountExposureSnapshot } from "../monthlyAccountGovernanceTypes";
import type {
  MonthlyAccountFinanceReviewStatus,
  MonthlyAccountGovernanceState,
} from "@/lib/database/types";
import { computeOverrideExpiryInfo } from "./computeOverrideExpiryInfo";
import { listMonthlyAccountCollectionsNotes } from "./monthlyAccountCollectionsNotesRepository";
import type { MonthlyGovernanceInternalAlert } from "../monthlyAccountGovernanceTypes";

export type MonthlyGovernanceCustomerRow = {
  customerId: string;
  customerName: string | null;
  governanceState: MonthlyAccountGovernanceState;
  outstandingBalanceCents: number;
  exposure: MonthlyAccountExposureSnapshot;
  creditLimitCents: number | null;
  overdueInvoiceCount: number;
  riskScore: number;
  riskLevel: string;
  recommendation: MonthlyAccountRiskRecommendation;
  lastFinanceReviewAt: string | null;
  lastPaymentAt: string | null;
  overrideActive: boolean;
  manualOverrideUntil: string | null;
  overrideExpiryLabel: string;
  overrideExpiringSoon: boolean;
  financeReviewStatus: MonthlyAccountFinanceReviewStatus | null;
  financeReviewOwnerAdminId: string | null;
  financeReviewFollowUpDate: string | null;
  financeReviewResolution: string | null;
  notesCount: number;
  lastActionAt: string | null;
};

export type MonthlyGovernanceSectionCounts = {
  approved: number;
  reviewRequired: number;
  financeHold: number;
  disputed: number;
  suspended: number;
  exposureExceeded: number;
  highRiskCollections: number;
  overrideActive: number;
  overrideExpiringSoon: number;
  openFinanceReviews: number;
};

export type MonthlyGovernanceDashboard = {
  governanceEnabled: boolean;
  customers: MonthlyGovernanceCustomerRow[];
  approved: MonthlyGovernanceCustomerRow[];
  reviewRequired: MonthlyGovernanceCustomerRow[];
  financeHold: MonthlyGovernanceCustomerRow[];
  disputed: MonthlyGovernanceCustomerRow[];
  suspended: MonthlyGovernanceCustomerRow[];
  exposureExceeded: MonthlyGovernanceCustomerRow[];
  highRiskCollections: MonthlyGovernanceCustomerRow[];
  overrideActive: MonthlyGovernanceCustomerRow[];
  overrideExpiringSoon: MonthlyGovernanceCustomerRow[];
  sectionCounts: MonthlyGovernanceSectionCounts;
  internalAlerts: MonthlyGovernanceInternalAlert[];
};

async function loadCustomerName(
  customerId: string,
  client: SupabaseClient<Database>,
): Promise<string | null> {
  const { data } = await client
    .from("customers")
    .select("id, profile_id, company_name")
    .eq("id", customerId)
    .maybeSingle();
  if (!data) return null;
  let profileName: string | null = null;
  if (data.profile_id) {
    const { data: profile } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", data.profile_id)
      .maybeSingle();
    profileName = profile?.full_name ?? null;
  }
  return data.company_name?.trim() || profileName;
}

function buildInternalAlerts(rows: MonthlyGovernanceCustomerRow[]): MonthlyGovernanceInternalAlert[] {
  const today = new Date().toISOString().slice(0, 10);
  const alerts: MonthlyGovernanceInternalAlert[] = [];

  for (const row of rows) {
    if (row.overrideExpiringSoon) {
      alerts.push({
        kind: "override_expiring_soon",
        customerId: row.customerId,
        customerName: row.customerName,
        message: `${row.customerName ?? row.customerId.slice(0, 8)} — temporary override ${row.overrideExpiryLabel.toLowerCase()}.`,
      });
    }
    if (
      row.financeReviewStatus === "open" &&
      row.financeReviewFollowUpDate &&
      row.financeReviewFollowUpDate <= today
    ) {
      alerts.push({
        kind: "finance_follow_up_due",
        customerId: row.customerId,
        customerName: row.customerName,
        message: `${row.customerName ?? row.customerId.slice(0, 8)} — finance review follow-up due ${row.financeReviewFollowUpDate}.`,
      });
    }
    if (
      row.financeReviewStatus === "open" &&
      (row.riskLevel === "high" || row.riskLevel === "critical")
    ) {
      alerts.push({
        kind: "high_risk_unresolved",
        customerId: row.customerId,
        customerName: row.customerName,
        message: `${row.customerName ?? row.customerId.slice(0, 8)} — high-risk account with open finance review.`,
      });
    }
  }

  return alerts;
}

export async function loadMonthlyGovernanceDashboard(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyGovernanceDashboard> {
  const governanceEnabled = isZohoMonthlyCreditGovernanceEnabled();
  const accounts = await listCustomerBillingAccounts({ status: "enabled", limit: 500 }, client);
  const collections = governanceEnabled ? await loadMonthlyCollectionsDashboard(client) : null;
  const highRiskIds = new Set(
    (collections?.highRisk ?? []).map((customer) => customer.customerId),
  );

  const rows: MonthlyGovernanceCustomerRow[] = [];

  for (const account of accounts) {
    const exposureResult = await loadMonthlyAccountExposureForCustomer(
      account.customerId,
      account,
      client,
    );
    const { lastPaymentAt, ...exposure } = exposureResult;
    const batches = await listMonthlyInvoiceBatches({ customerId: account.customerId, limit: 200 }, client);
    let reminderCount = 0;
    let failedDeliveryCount = 0;
    let recentPaidCount30d = 0;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const batch of batches) {
      const delivery = readMonthlyInvoiceDeliveryMetadata(batch.metadata);
      reminderCount += delivery.reminderCount;
      failedDeliveryCount += delivery.deliveryFailures;
      if (batch.paidAt && new Date(batch.paidAt).getTime() >= thirtyDaysAgo) {
        recentPaidCount30d += 1;
      }
    }
    const risk = computeMonthlyAccountRiskScore({
      overdueInvoiceCount: exposure.overdueInvoiceCount,
      averageDaysLate: exposure.overdueInvoiceCount > 0 ? 14 : 0,
      unpaidBalanceCents: exposure.outstandingBalanceCents,
      reminderCount,
      disputedInvoiceCount: exposure.disputedInvoiceCount,
      failedDeliveryCount,
      recentPaidCount30d,
    });

    const customerName = await loadCustomerName(account.customerId, client);
    const notes = await listMonthlyAccountCollectionsNotes({
      customerId: account.customerId,
      limit: 200,
    });
    const overrideInfo = computeOverrideExpiryInfo(account.manualOverrideUntil);
    const lastActionAt =
      account.lastFinanceReviewAt ??
      account.updatedAt ??
      notes[0]?.createdAt ??
      null;

    rows.push({
      customerId: account.customerId,
      customerName,
      governanceState: account.governanceState,
      outstandingBalanceCents: exposure.outstandingBalanceCents,
      exposure,
      creditLimitCents: account.creditLimitCents,
      overdueInvoiceCount: exposure.overdueInvoiceCount,
      riskScore: risk.score,
      riskLevel: risk.level,
      recommendation: risk.recommendation,
      lastFinanceReviewAt: account.lastFinanceReviewAt,
      lastPaymentAt,
      overrideActive: isMonthlyAccountOverrideActive(account),
      manualOverrideUntil: account.manualOverrideUntil,
      overrideExpiryLabel: overrideInfo.label,
      overrideExpiringSoon: overrideInfo.state === "expiring_soon",
      financeReviewStatus: account.financeReviewStatus,
      financeReviewOwnerAdminId: account.financeReviewOwnerAdminId,
      financeReviewFollowUpDate: account.financeReviewFollowUpDate,
      financeReviewResolution: account.financeReviewResolution,
      notesCount: notes.length,
      lastActionAt,
    });
  }

  const byState = (state: MonthlyAccountGovernanceState) =>
    rows.filter((row) => row.governanceState === state);

  const approved = byState("approved");
  const reviewRequired = byState("account_review_required");
  const financeHold = byState("finance_hold");
  const disputed = byState("disputed");
  const suspended = byState("suspended");
  const exposureExceeded = rows.filter((row) => row.exposure.exposureBand === "exceeded");
  const highRiskCollections = rows.filter((row) => highRiskIds.has(row.customerId));
  const overrideActive = rows.filter((row) => row.overrideActive);
  const overrideExpiringSoon = rows.filter((row) => row.overrideExpiringSoon);

  const sectionCounts: MonthlyGovernanceSectionCounts = {
    approved: approved.length,
    reviewRequired: reviewRequired.length,
    financeHold: financeHold.length,
    disputed: disputed.length,
    suspended: suspended.length,
    exposureExceeded: exposureExceeded.length,
    highRiskCollections: highRiskCollections.length,
    overrideActive: overrideActive.length,
    overrideExpiringSoon: overrideExpiringSoon.length,
    openFinanceReviews: rows.filter((row) => row.financeReviewStatus === "open").length,
  };

  return {
    governanceEnabled,
    customers: rows,
    approved,
    reviewRequired,
    financeHold,
    disputed,
    suspended,
    exposureExceeded,
    highRiskCollections,
    overrideActive,
    overrideExpiringSoon,
    sectionCounts,
    internalAlerts: buildInternalAlerts(rows),
  };
}
