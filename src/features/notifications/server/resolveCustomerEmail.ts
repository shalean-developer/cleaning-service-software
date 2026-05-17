import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

export type ResolvedCustomerEmail = {
  email: string;
  displayName: string | null;
};

export type ResolveCustomerEmailResult =
  | { ok: true; recipient: ResolvedCustomerEmail }
  | { ok: false; code: "CUSTOMER_NOT_FOUND" | "NO_EMAIL" };

/**
 * Resolves customers.id → auth email via profile_id (no PII in logs).
 */
export async function resolveCustomerEmail(
  client: SupabaseClient<Database>,
  customerId: string,
): Promise<ResolveCustomerEmailResult> {
  const { data: customer, error: customerError } = await client
    .from("customers")
    .select("id, profile_id")
    .eq("id", customerId)
    .maybeSingle();

  if (customerError || !customer) {
    return { ok: false, code: "CUSTOMER_NOT_FOUND" };
  }

  const { data: profile } = await client
    .from("profiles")
    .select("full_name")
    .eq("id", customer.profile_id)
    .maybeSingle();

  const { data: authData, error: authError } = await client.auth.admin.getUserById(
    customer.profile_id,
  );

  const email = authData?.user?.email?.trim();
  if (authError || !email) {
    return { ok: false, code: "NO_EMAIL" };
  }

  const displayName = profile?.full_name?.trim() || null;

  return {
    ok: true,
    recipient: { email, displayName },
  };
}
