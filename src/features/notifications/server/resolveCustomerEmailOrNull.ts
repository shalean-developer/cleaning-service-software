import "server-only";

import { resolveCustomerEmail } from "./resolveCustomerEmail";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

/**
 * Admin read-model helper: resolves auth email via service role (read-only).
 * Returns null when customer, profile, or auth user is missing — never throws.
 */
export async function resolveCustomerEmailOrNull(customerId: string): Promise<string | null> {
  try {
    const client = requireServiceRoleClient();
    const result = await resolveCustomerEmail(client, customerId);
    return result.ok ? result.recipient.email : null;
  } catch {
    return null;
  }
}

/**
 * Batch email resolution with bounded concurrency (read-only).
 */
export async function resolveCustomerEmailsOrNull(
  customerIds: string[],
  concurrency = 10,
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  const uniqueIds = [...new Set(customerIds)];
  if (uniqueIds.length === 0) return results;

  for (let i = 0; i < uniqueIds.length; i += concurrency) {
    const chunk = uniqueIds.slice(i, i + concurrency);
    const resolved = await Promise.all(
      chunk.map(async (customerId) => {
        const email = await resolveCustomerEmailOrNull(customerId);
        return [customerId, email] as const;
      }),
    );
    for (const [customerId, email] of resolved) {
      results.set(customerId, email);
    }
  }

  return results;
}
