import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { resolveCustomerEmailOrNull } from "@/features/notifications/server/resolveCustomerEmailOrNull";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  getCustomerBillingAccount,
  getCustomerBillingAccountAudit,
  listCustomerBillingAccounts,
} from "./customerBillingAccountRepository";
import {
  getMonthlyInvoiceBatchForCustomerMonth,
  listMonthlyInvoiceBatches,
} from "./monthlyInvoiceBatchRepository";
import { resolveBillingMonthFromInstant } from "./resolveBillingMonth";
import type { CustomerBillingAccount, CustomerBillingAccountAuditEntry } from "./monthlyBillingTypes";

const MAX_OVERVIEW_ACCOUNTS = 500;
const MAX_OVERVIEW_BATCHES = 500;

export type CustomerBillingAccountAuditSummary = {
  totalEntries: number;
  latestAction: string | null;
  latestAt: string | null;
};

export type CustomerBillingLatestBatchSummary = {
  batchId: string;
  billingMonth: string;
  status: string;
  totalCents: number;
  itemCount: number;
} | null;

export type CustomerBillingAccountReadModel = {
  customerId: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  account: CustomerBillingAccount | null;
  billingMode: string | null;
  monthlyAccountEnabled: boolean;
  zohoCustomerId: string | null;
  billingEmail: string | null;
  billingTerms: string | null;
  approvedByAdminId: string | null;
  approvedAt: string | null;
  disabledAt: string | null;
  disabledByAdminId: string | null;
  accountStatusLabel: string;
  auditSummary: CustomerBillingAccountAuditSummary;
  latestMonthlyBatch: CustomerBillingLatestBatchSummary;
  currentMonthAccruedBatch: CustomerBillingLatestBatchSummary;
  auditEntries: CustomerBillingAccountAuditEntry[];
  draftMonthlyAccountBookingsAwaitingAuthorization: number;
};

export type MonthlyBillingAccountsOverview = {
  totalAccounts: number;
  monthlyAccountsEnabled: number;
  monthlyAccountsDisabled: number;
  accountsNeedingZohoLink: number;
  draftBatches: number;
  generatedBatches: number;
  sentBatches: number;
  paidBatches: number;
  overdueBatches: number;
  outstandingAmountCents: number;
  draftMonthlyAccountBookings: number;
  serviceAuthorizedNotInvoicedBookings: number;
};

function summarizeAudit(entries: CustomerBillingAccountAuditEntry[]): CustomerBillingAccountAuditSummary {
  const latest = entries[0];
  return {
    totalEntries: entries.length,
    latestAction: latest?.action ?? null,
    latestAt: latest?.createdAt ?? null,
  };
}

function accountStatusLabel(account: CustomerBillingAccount | null): string {
  if (!account) return "No billing account";
  if (account.disabledAt) return "Disabled";
  if (account.isMonthlyAccountEnabled) return "Monthly account active";
  return "Standard billing";
}

async function loadCustomerContact(
  customerId: string,
  client: SupabaseClient<Database>,
): Promise<{ name: string | null; phone: string | null; email: string | null }> {
  const { data: customer, error } = await client
    .from("customers")
    .select("id, profile_id, company_name, phone")
    .eq("id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!customer) {
    return { name: null, phone: null, email: null };
  }

  let profileName: string | null = null;
  if (customer.profile_id) {
    const { data: profile } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", customer.profile_id)
      .maybeSingle();
    profileName = profile?.full_name ?? null;
  }

  const email = await resolveCustomerEmailOrNull(customerId);

  return {
    name: customer.company_name?.trim() || profileName,
    phone: customer.phone,
    email,
  };
}

export async function loadCustomerBillingAccountReadModel(
  customerId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CustomerBillingAccountReadModel> {
  const [account, auditEntries, contact] = await Promise.all([
    getCustomerBillingAccount(customerId, client),
    getCustomerBillingAccountAudit(customerId, client),
    loadCustomerContact(customerId, client),
  ]);

  let latestMonthlyBatch: CustomerBillingLatestBatchSummary = null;
  let currentMonthAccruedBatch: CustomerBillingLatestBatchSummary = null;
  let draftMonthlyAccountBookingsAwaitingAuthorization = 0;
  if (account) {
    const batches = await listMonthlyInvoiceBatches({ customerId, limit: 1 }, client);
    const latest = batches[0];
    if (latest) {
      const { count } = await client
        .from("monthly_invoice_batch_items")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", latest.id);
      latestMonthlyBatch = {
        batchId: latest.id,
        billingMonth: latest.billingMonth,
        status: latest.status,
        totalCents: latest.totalCents,
        itemCount: count ?? 0,
      };
    }

    const currentBillingMonth = resolveBillingMonthFromInstant(new Date().toISOString());
    if (currentBillingMonth) {
      currentMonthAccruedBatch = await loadCustomerBillingAccountForMonth(
        customerId,
        currentBillingMonth,
        client,
      );
    }

    const { count: draftCount, error: draftCountError } = await client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .eq("status", "draft")
      .filter("metadata->billing->>mode", "eq", "monthly_account");

    if (draftCountError) throw new Error(draftCountError.message);
    draftMonthlyAccountBookingsAwaitingAuthorization = draftCount ?? 0;
  }

  return {
    customerId,
    customerName: contact.name,
    customerEmail: contact.email,
    customerPhone: contact.phone,
    account,
    billingMode: account?.billingMode ?? null,
    monthlyAccountEnabled: account?.isMonthlyAccountEnabled ?? false,
    zohoCustomerId: account?.zohoCustomerId ?? null,
    billingEmail: account?.billingEmail ?? null,
    billingTerms: account?.billingTerms ?? null,
    approvedByAdminId: account?.approvedByAdminId ?? null,
    approvedAt: account?.approvedAt ?? null,
    disabledAt: account?.disabledAt ?? null,
    disabledByAdminId: account?.disabledByAdminId ?? null,
    accountStatusLabel: accountStatusLabel(account),
    auditSummary: summarizeAudit(auditEntries),
    latestMonthlyBatch,
    currentMonthAccruedBatch,
    auditEntries,
    draftMonthlyAccountBookingsAwaitingAuthorization,
  };
}

export async function loadMonthlyBillingAccountsOverview(
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<MonthlyBillingAccountsOverview> {
  const accounts = await listCustomerBillingAccounts({ limit: MAX_OVERVIEW_ACCOUNTS }, client);
  const batches = await listMonthlyInvoiceBatches({ limit: MAX_OVERVIEW_BATCHES }, client);

  const monthlyAccountsEnabled = accounts.filter((a) => a.isMonthlyAccountEnabled).length;
  const monthlyAccountsDisabled = accounts.filter((a) => !a.isMonthlyAccountEnabled).length;
  const accountsNeedingZohoLink = accounts.filter(
    (a) => a.isMonthlyAccountEnabled && !a.zohoCustomerId,
  ).length;
  const draftBatches = batches.filter((b) => b.status === "draft").length;
  const generatedBatches = batches.filter((b) => b.status === "generated").length;
  const sentBatches = batches.filter((b) => b.status === "sent").length;
  const paidBatches = batches.filter((b) => b.status === "paid").length;
  const overdueBatches = batches.filter((b) => b.status === "overdue").length;

  const outstandingAmountCents = batches
    .filter((b) => b.status === "sent" || b.status === "overdue" || b.status === "generated")
    .reduce((sum, b) => sum + b.totalCents, 0);

  const { count: draftMonthlyAccountBookings, error: draftBookingsError } = await client
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft")
    .filter("metadata->billing->>mode", "eq", "monthly_account");

  if (draftBookingsError) {
    throw new Error(draftBookingsError.message);
  }

  const { count: serviceAuthorizedNotInvoiced, error: authorizedError } = await client
    .from("monthly_service_authorizations")
    .select("id", { count: "exact", head: true })
    .eq("status", "authorized");

  if (authorizedError) {
    throw new Error(authorizedError.message);
  }

  return {
    totalAccounts: accounts.length,
    monthlyAccountsEnabled,
    monthlyAccountsDisabled,
    accountsNeedingZohoLink,
    draftBatches,
    generatedBatches,
    sentBatches,
    paidBatches,
    overdueBatches,
    outstandingAmountCents,
    draftMonthlyAccountBookings: draftMonthlyAccountBookings ?? 0,
    serviceAuthorizedNotInvoicedBookings: serviceAuthorizedNotInvoiced ?? 0,
  };
}

export type CustomerBillingAccountListItem = CustomerBillingAccountReadModel;

export async function loadCustomerBillingAccountList(
  filters: Parameters<typeof listCustomerBillingAccounts>[0] = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CustomerBillingAccountListItem[]> {
  const accounts = await listCustomerBillingAccounts(filters, client);
  const results: CustomerBillingAccountListItem[] = [];

  for (const account of accounts) {
    results.push(await loadCustomerBillingAccountReadModel(account.customerId, client));
  }

  return results;
}

export async function loadCustomerBillingAccountForMonth(
  customerId: string,
  billingMonth: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CustomerBillingLatestBatchSummary> {
  const batch = await getMonthlyInvoiceBatchForCustomerMonth(customerId, billingMonth, client);
  if (!batch) return null;

  const { count } = await client
    .from("monthly_invoice_batch_items")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batch.id);

  return {
    batchId: batch.id,
    billingMonth: batch.billingMonth,
    status: batch.status,
    totalCents: batch.totalCents,
    itemCount: count ?? 0,
  };
}
