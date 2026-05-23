import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCustomerEmailOrNull } from "@/features/notifications/server/resolveCustomerEmailOrNull";
import type { CustomerBillingAccountRow, Database, Json } from "@/lib/database/types";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import { mapCustomerBillingAccountRow } from "./customerBillingAccountMapping";
import type { CustomerBillingAccount } from "./monthlyBillingTypes";

function mapAccountRow(row: CustomerBillingAccountRow): CustomerBillingAccount {
  return mapCustomerBillingAccountRow(row);
}

export function accountAuditSnapshot(account: CustomerBillingAccount | null) {
  if (!account) return null;
  return {
    billingMode: account.billingMode,
    billingEmail: account.billingEmail,
    billingTerms: account.billingTerms,
    isMonthlyAccountEnabled: account.isMonthlyAccountEnabled,
    zohoCustomerId: account.zohoCustomerId,
    disabledAt: account.disabledAt,
    governanceState: account.governanceState,
    creditLimitCents: account.creditLimitCents,
    manualOverrideUntil: account.manualOverrideUntil,
  };
}

export async function upsertEnabledMonthlyBillingAccount(
  client: SupabaseClient<Database>,
  input: {
    customerId: string;
    billingEmail: string;
    billingTerms: string;
    approvalReason: string;
    adminProfileId: string;
    zohoCustomerId: string | null;
  },
): Promise<CustomerBillingAccount> {
  const now = new Date().toISOString();
  const existing = await getCustomerBillingAccount(input.customerId, client);

  const payload = {
    customer_id: input.customerId,
    billing_mode: "monthly_account" as const,
    billing_email: input.billingEmail.trim(),
    billing_terms: input.billingTerms.trim(),
    is_monthly_account_enabled: true,
    approved_by_admin_id: input.adminProfileId,
    approved_at: now,
    approval_reason: input.approvalReason.trim(),
    disabled_at: null,
    disabled_by_admin_id: null,
    zoho_customer_id: input.zohoCustomerId,
    metadata: (existing?.metadata ?? {}) as Json,
  };

  const { data, error } = await client
    .from("customer_billing_accounts")
    .upsert(payload, { onConflict: "customer_id" })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to upsert billing account.");
  return mapAccountRow(data as CustomerBillingAccountRow);
}

export async function disableMonthlyBillingAccount(
  client: SupabaseClient<Database>,
  input: {
    customerId: string;
    adminProfileId: string;
    reason: string;
  },
): Promise<CustomerBillingAccount> {
  const existing = await getCustomerBillingAccount(input.customerId, client);
  if (!existing) {
    throw new Error("Billing account not found.");
  }

  const metadata = {
    ...existing.metadata,
    disabledReason: input.reason.trim(),
  };

  const { data, error } = await client
    .from("customer_billing_accounts")
    .update({
      is_monthly_account_enabled: false,
      disabled_at: new Date().toISOString(),
      disabled_by_admin_id: input.adminProfileId,
      metadata,
    })
    .eq("customer_id", input.customerId)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to disable billing account.");
  return mapAccountRow(data as CustomerBillingAccountRow);
}

export async function updateMonthlyBillingAccountTerms(
  client: SupabaseClient<Database>,
  input: {
    customerId: string;
    billingEmail: string;
    billingTerms: string;
  },
): Promise<CustomerBillingAccount> {
  const existing = await getCustomerBillingAccount(input.customerId, client);
  if (!existing) {
    throw new Error("Billing account not found.");
  }

  const { data, error } = await client
    .from("customer_billing_accounts")
    .update({
      billing_email: input.billingEmail.trim(),
      billing_terms: input.billingTerms.trim(),
    })
    .eq("customer_id", input.customerId)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to update billing terms.");
  return mapAccountRow(data as CustomerBillingAccountRow);
}

export async function linkMonthlyBillingZohoCustomer(
  client: SupabaseClient<Database>,
  input: {
    customerId: string;
    zohoCustomerId: string;
    billingEmail?: string;
    billingTerms?: string;
  },
): Promise<CustomerBillingAccount> {
  const existing = await getCustomerBillingAccount(input.customerId, client);
  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await client
      .from("customer_billing_accounts")
      .update({ zoho_customer_id: input.zohoCustomerId.trim() })
      .eq("customer_id", input.customerId)
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to link Zoho customer.");
    return mapAccountRow(data as CustomerBillingAccountRow);
  }

  const billingEmail =
    input.billingEmail?.trim() || (await resolveCustomerEmailOrNull(input.customerId)) || "billing@unknown.local";
  const billingTerms = input.billingTerms?.trim() || "Pending setup";

  const { data, error } = await client
    .from("customer_billing_accounts")
    .insert({
      customer_id: input.customerId,
      billing_mode: "pay_now",
      billing_email: billingEmail,
      billing_terms: billingTerms,
      is_monthly_account_enabled: false,
      zoho_customer_id: input.zohoCustomerId.trim(),
      metadata: { linkedBeforeEnable: true, linkedAt: now },
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create billing account with Zoho link.");
  return mapAccountRow(data as CustomerBillingAccountRow);
}

export async function assertCustomerExists(
  client: SupabaseClient<Database>,
  customerId: string,
): Promise<boolean> {
  const { data, error } = await client.from("customers").select("id").eq("id", customerId).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}

export async function loadCustomerDisplayName(
  client: SupabaseClient<Database>,
  customerId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("customers")
    .select("company_name, profile_id")
    .eq("id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  if (data.company_name?.trim()) return data.company_name.trim();

  if (data.profile_id) {
    const { data: profile } = await client
      .from("profiles")
      .select("full_name")
      .eq("id", data.profile_id)
      .maybeSingle();
    return profile?.full_name?.trim() || null;
  }

  return null;
}
