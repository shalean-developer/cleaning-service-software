import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCustomerEmailsOrNull } from "@/features/notifications/server/resolveCustomerEmailOrNull";
import type { Database } from "@/lib/database/types";

export type AdminAssistedBookingCustomerFields = {
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
};

export function customerLabelFromCustomerFields(
  fields: Pick<AdminAssistedBookingCustomerFields, "customer_name" | "customer_email">,
  fallbackId: string,
): string {
  return fields.customer_name?.trim() || fields.customer_email?.trim() || fallbackId.slice(0, 8);
}

export async function loadAdminAssistedBookingCustomerFieldsByCustomerId(
  client: SupabaseClient<Database>,
  customerIds: string[],
): Promise<Map<string, AdminAssistedBookingCustomerFields>> {
  const results = new Map<string, AdminAssistedBookingCustomerFields>();
  const uniqueIds = [...new Set(customerIds.filter(Boolean))];
  if (uniqueIds.length === 0) return results;

  const { data: customers, error } = await client
    .from("customers")
    .select("id, company_name, phone, profile_id")
    .in("id", uniqueIds);

  if (error) throw new Error(error.message);

  const profileIds = [...new Set((customers ?? []).map((row) => row.profile_id))];
  const profileNames = new Map<string, string | null>();

  if (profileIds.length > 0) {
    const { data: profiles, error: profileError } = await client
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);

    if (profileError) throw new Error(profileError.message);

    for (const profile of profiles ?? []) {
      profileNames.set(profile.id, profile.full_name);
    }
  }

  const emails = await resolveCustomerEmailsOrNull(uniqueIds, 10);

  for (const customer of customers ?? []) {
    const customerName =
      customer.company_name?.trim() ||
      profileNames.get(customer.profile_id)?.trim() ||
      null;

    results.set(customer.id, {
      customer_name: customerName,
      customer_email: emails.get(customer.id) ?? null,
      customer_phone: customer.phone?.trim() || null,
    });
  }

  for (const customerId of uniqueIds) {
    if (!results.has(customerId)) {
      results.set(customerId, {
        customer_name: null,
        customer_email: emails.get(customerId) ?? null,
        customer_phone: null,
      });
    }
  }

  return results;
}

export async function withAdminAssistedBookingCustomerFields<
  T extends { id: string; customer_id: string },
>(client: SupabaseClient<Database>, rows: T[]): Promise<Array<T & AdminAssistedBookingCustomerFields>> {
  const fieldsByCustomerId = await loadAdminAssistedBookingCustomerFieldsByCustomerId(
    client,
    rows.map((row) => row.customer_id),
  );

  return rows.map((row) => {
    const fields = fieldsByCustomerId.get(row.customer_id) ?? {
      customer_name: null,
      customer_email: null,
      customer_phone: null,
    };
    return { ...row, ...fields };
  });
}
