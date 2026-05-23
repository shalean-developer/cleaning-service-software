import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CustomerBillingAccountAuditRow,
  CustomerBillingAccountRow,
  Database,
} from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { mapCustomerBillingAccountRow } from "./customerBillingAccountMapping";
import type {
  CustomerBillingAccount,
  CustomerBillingAccountAuditEntry,
} from "./monthlyBillingTypes";

const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;

export type ListCustomerBillingAccountsFilters = {
  /** Filter by monthly account enabled state. */
  status?: "enabled" | "disabled" | "all";
  /** Filter by billing mode. */
  mode?: CustomerBillingAccount["billingMode"];
  limit?: number;
};

function mapAccountRow(row: CustomerBillingAccountRow): CustomerBillingAccount {
  return mapCustomerBillingAccountRow(row);
}

function mapAuditRow(row: CustomerBillingAccountAuditRow): CustomerBillingAccountAuditEntry {
  return {
    id: row.id,
    accountId: row.account_id,
    customerId: row.customer_id,
    adminProfileId: row.admin_profile_id,
    action: row.action,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

function clampLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(1, Math.floor(limit)), MAX_LIST_LIMIT);
}

export async function getCustomerBillingAccount(
  customerId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CustomerBillingAccount | null> {
  const { data, error } = await client
    .from("customer_billing_accounts")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapAccountRow(data as CustomerBillingAccountRow) : null;
}

export async function listCustomerBillingAccounts(
  filters: ListCustomerBillingAccountsFilters = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CustomerBillingAccount[]> {
  const limit = clampLimit(filters.limit);
  let query = client
    .from("customer_billing_accounts")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (filters.status === "enabled") {
    query = query.eq("is_monthly_account_enabled", true);
  } else if (filters.status === "disabled") {
    query = query.eq("is_monthly_account_enabled", false);
  }

  if (filters.mode) {
    query = query.eq("billing_mode", filters.mode);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapAccountRow(row as CustomerBillingAccountRow));
}

export async function getCustomerBillingAccountAudit(
  customerId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CustomerBillingAccountAuditEntry[]> {
  const { data, error } = await client
    .from("customer_billing_account_audit")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapAuditRow(row as CustomerBillingAccountAuditRow));
}
