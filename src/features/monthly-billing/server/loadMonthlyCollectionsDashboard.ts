import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isZohoMonthlyCollectionsEnabled } from "@/lib/app/zohoMonthlyCollectionsFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { listMonthlyInvoiceBatches } from "./monthlyInvoiceBatchRepository";
import { getCustomerBillingAccount, listCustomerBillingAccounts } from "./customerBillingAccountRepository";
import { resolveMonthlyInvoiceDueDate } from "./enqueueMonthlyInvoiceNotification";
import {
  computeInvoiceAgingBucket,
  daysBetweenDates,
  readMonthlyInvoiceDeliveryMetadata,
} from "./monthlyInvoiceDeliveryTypes";
import { computeMonthlyInvoiceReminderState } from "./computeMonthlyInvoiceReminderState";
import {
  computeMonthlyAccountRiskScore,
  type MonthlyAccountRiskRecommendation,
} from "./computeMonthlyAccountRiskScore";

export type MonthlyCollectionsBatchItem = {
  batchId: string;
  customerId: string;
  customerName: string | null;
  billingMonth: string;
  status: string;
  totalCents: number;
  dueDate: string | null;
  agingBucket: string;
  reminderCount: number;
  collectionsState: string;
  invoiceNumber: string | null;
  paidAt: string | null;
  sentAt: string | null;
};

export type MonthlyCollectionsCustomerSummary = {
  customerId: string;
  customerName: string | null;
  outstandingTotalCents: number;
  oldestUnpaidDueDate: string | null;
  overdueCount: number;
  reminderCount: number;
  lastPaymentAt: string | null;
  averagePaymentDelayDays: number | null;
  riskScore: number;
  riskLevel: string;
  recommendation: MonthlyAccountRiskRecommendation;
  batches: MonthlyCollectionsBatchItem[];
};

export type MonthlyCollectionsDashboard = {
  collectionsEnabled: boolean;
  healthy: MonthlyCollectionsCustomerSummary[];
  reminderDue: MonthlyCollectionsCustomerSummary[];
  overdue: MonthlyCollectionsCustomerSummary[];
  escalationRecommended: MonthlyCollectionsCustomerSummary[];
  disputed: MonthlyCollectionsCustomerSummary[];
  highRisk: MonthlyCollectionsCustomerSummary[];
  agingBuckets: Record<string, number>;
  metrics: {
    autoSendEligibleCount: number;
    failedDeliveries: number;
    batchesWithoutSuccessfulSend: number;
    overdueRecoveryRate: number | null;
    averagePaymentDays: number | null;
  };
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

export async function loadMonthlyCollectionsDashboard(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyCollectionsDashboard> {
  const collectionsEnabled = isZohoMonthlyCollectionsEnabled();
  const batches = await listMonthlyInvoiceBatches({ limit: 500 }, client);
  const accounts = await listCustomerBillingAccounts({ status: "enabled", limit: 500 }, client);
  const accountByCustomer = new Map(accounts.map((a) => [a.customerId, a]));

  const agingBuckets: Record<string, number> = {
    current: 0,
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };

  const customerMap = new Map<string, MonthlyCollectionsCustomerSummary>();
  let failedDeliveries = 0;
  let batchesWithoutSuccessfulSend = 0;
  let autoSendEligibleCount = 0;

  const paidDelays: number[] = [];
  const nowIso = new Date().toISOString();

  for (const batch of batches) {
    const delivery = readMonthlyInvoiceDeliveryMetadata(batch.metadata);
    failedDeliveries += delivery.deliveryFailures;
    if (
      (batch.status === "sent" || batch.status === "overdue" || batch.status === "generated") &&
      !delivery.lastSuccessfulDeliveryAt &&
      delivery.sentChannels.length === 0
    ) {
      batchesWithoutSuccessfulSend += 1;
    }
    if (batch.status === "generated" && delivery.autoSendEnabled) {
      autoSendEligibleCount += 1;
    }

    const account = accountByCustomer.get(batch.customerId);
    const dueDate = account ? resolveMonthlyInvoiceDueDate(batch, account) : null;
    const bucket = computeInvoiceAgingBucket(dueDate);
    if (batch.status === "sent" || batch.status === "overdue" || batch.status === "generated") {
      agingBuckets[bucket] = (agingBuckets[bucket] ?? 0) + 1;
    }

    if (batch.status === "paid" && batch.paidAt && batch.sentAt) {
      paidDelays.push(daysBetweenDates(batch.sentAt.slice(0, 10), batch.paidAt.slice(0, 10)));
    }

    if (batch.status === "paid" || batch.status === "void" || batch.status === "draft") continue;

    const evaluation = computeMonthlyInvoiceReminderState({
      batchStatus: batch.status,
      dueDate,
      metadata: batch.metadata,
    });

    const customerName = await loadCustomerName(batch.customerId, client);
    const item: MonthlyCollectionsBatchItem = {
      batchId: batch.id,
      customerId: batch.customerId,
      customerName,
      billingMonth: batch.billingMonth,
      status: batch.status,
      totalCents: batch.totalCents,
      dueDate,
      agingBucket: bucket,
      reminderCount: delivery.reminderCount,
      collectionsState: delivery.collectionsState,
      invoiceNumber: batch.zohoInvoiceNumber,
      paidAt: batch.paidAt,
      sentAt: batch.sentAt,
    };

    let summary = customerMap.get(batch.customerId);
    if (!summary) {
      summary = {
        customerId: batch.customerId,
        customerName,
        outstandingTotalCents: 0,
        oldestUnpaidDueDate: null,
        overdueCount: 0,
        reminderCount: 0,
        lastPaymentAt: null,
        averagePaymentDelayDays: null,
        riskScore: 0,
        riskLevel: "low",
        recommendation: "continue_normal",
        batches: [],
      };
      customerMap.set(batch.customerId, summary);
    }

    summary.batches.push(item);
    if (batch.status === "sent" || batch.status === "overdue" || batch.status === "generated") {
      summary.outstandingTotalCents += batch.totalCents;
    }
    if (batch.status === "overdue") summary.overdueCount += 1;
    summary.reminderCount += delivery.reminderCount;
    if (dueDate && (!summary.oldestUnpaidDueDate || dueDate < summary.oldestUnpaidDueDate)) {
      summary.oldestUnpaidDueDate = dueDate;
    }
    if (batch.paidAt && (!summary.lastPaymentAt || batch.paidAt > summary.lastPaymentAt)) {
      summary.lastPaymentAt = batch.paidAt;
    }

    if (evaluation.collectionsState === "disputed") {
      delivery.collectionsState = "disputed";
    }
  }

  const customers = [...customerMap.values()];
  for (const customer of customers) {
    const disputedCount = customer.batches.filter((b) => b.collectionsState === "disputed").length;
    const risk = computeMonthlyAccountRiskScore({
      overdueInvoiceCount: customer.overdueCount,
      averageDaysLate:
        customer.oldestUnpaidDueDate != null
          ? Math.max(0, daysBetweenDates(customer.oldestUnpaidDueDate, nowIso))
          : 0,
      unpaidBalanceCents: customer.outstandingTotalCents,
      reminderCount: customer.reminderCount,
      disputedInvoiceCount: disputedCount,
      failedDeliveryCount: customer.batches.reduce(
        (sum, b) =>
          sum +
          readMonthlyInvoiceDeliveryMetadata(
            batches.find((row) => row.id === b.batchId)?.metadata ?? {},
          ).deliveryFailures,
        0,
      ),
      recentPaidCount30d: customer.lastPaymentAt
        ? daysBetweenDates(customer.lastPaymentAt, nowIso) <= 30
          ? 1
          : 0
        : 0,
    });
    customer.riskScore = risk.score;
    customer.riskLevel = risk.level;
    customer.recommendation = risk.recommendation;
    if (customer.lastPaymentAt && paidDelays.length > 0) {
      customer.averagePaymentDelayDays =
        Math.round((paidDelays.reduce((a, b) => a + b, 0) / paidDelays.length) * 10) / 10;
    }
  }

  const healthy: MonthlyCollectionsCustomerSummary[] = [];
  const reminderDue: MonthlyCollectionsCustomerSummary[] = [];
  const overdue: MonthlyCollectionsCustomerSummary[] = [];
  const escalationRecommended: MonthlyCollectionsCustomerSummary[] = [];
  const disputed: MonthlyCollectionsCustomerSummary[] = [];
  const highRisk: MonthlyCollectionsCustomerSummary[] = [];

  for (const customer of customers) {
    const states = new Set(customer.batches.map((b) => b.collectionsState));
    if (states.has("disputed")) disputed.push(customer);
    else if (states.has("escalation_recommended")) escalationRecommended.push(customer);
    else if (customer.overdueCount > 0) overdue.push(customer);
    else if (states.has("reminder_due")) reminderDue.push(customer);
    else healthy.push(customer);

    if (customer.riskLevel === "high" || customer.riskLevel === "critical") {
      highRisk.push(customer);
    }
  }

  const overduePaid = batches.filter((b) => b.status === "paid" && b.metadata).length;
  const overdueTotal = batches.filter((b) => b.status === "overdue" || b.status === "paid").length;

  return {
    collectionsEnabled,
    healthy,
    reminderDue,
    overdue,
    escalationRecommended,
    disputed,
    highRisk,
    agingBuckets,
    metrics: {
      autoSendEligibleCount,
      failedDeliveries,
      batchesWithoutSuccessfulSend,
      overdueRecoveryRate:
        overdueTotal > 0 ? Math.round((overduePaid / overdueTotal) * 1000) / 10 : null,
      averagePaymentDays:
        paidDelays.length > 0
          ? Math.round((paidDelays.reduce((a, b) => a + b, 0) / paidDelays.length) * 10) / 10
          : null,
    },
  };
}
