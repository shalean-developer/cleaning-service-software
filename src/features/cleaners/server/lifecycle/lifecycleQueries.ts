import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

const ACTIVE_BOOKING_STATUSES = ["assigned", "in_progress"] as const;

export async function countActiveBookingsForCleaner(
  client: SupabaseClient<Database>,
  cleanerId: string,
): Promise<number> {
  const { count: leadCount, error: leadError } = await client
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("cleaner_id", cleanerId)
    .in("status", [...ACTIVE_BOOKING_STATUSES]);
  if (leadError) throw new Error(leadError.message);

  const { data: rosterRows, error: rosterListError } = await client
    .from("booking_cleaners")
    .select("booking_id")
    .eq("cleaner_id", cleanerId);
  if (rosterListError) throw new Error(rosterListError.message);

  const rosterBookingIds = (rosterRows ?? []).map((r) => r.booking_id);
  if (rosterBookingIds.length === 0) {
    return leadCount ?? 0;
  }

  const { count: rosterActiveCount, error: rosterActiveError } = await client
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .in("id", rosterBookingIds)
    .in("status", [...ACTIVE_BOOKING_STATUSES]);
  if (rosterActiveError) throw new Error(rosterActiveError.message);

  return Math.max(leadCount ?? 0, rosterActiveCount ?? 0);
}

export async function countPendingEarningsForCleaner(
  client: SupabaseClient<Database>,
  cleanerId: string,
): Promise<number> {
  const { count, error } = await client
    .from("earning_lines")
    .select("*", { count: "exact", head: true })
    .eq("cleaner_id", cleanerId)
    .eq("payout_status", "pending");
  if (error) throw new Error(error.message);
  return count ?? 0;
}
