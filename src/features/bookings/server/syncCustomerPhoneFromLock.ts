import "server-only";

import { normalizeZaMobilePhone } from "@/lib/validation/zaPhone";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Persists the booking contact phone on the customer profile when valid.
 * Uses the user-scoped client so RLS applies for customer-initiated locks.
 */
export async function syncCustomerPhoneFromLock(
  client: SupabaseClient,
  customerId: string,
  contactPhone: string | null | undefined,
): Promise<void> {
  const e164 = normalizeZaMobilePhone(contactPhone);
  if (!e164) return;

  const { data: existing } = await client
    .from("customers")
    .select("phone")
    .eq("id", customerId)
    .maybeSingle();

  if (existing?.phone === e164) return;

  await client.from("customers").update({ phone: e164 }).eq("id", customerId);
}
