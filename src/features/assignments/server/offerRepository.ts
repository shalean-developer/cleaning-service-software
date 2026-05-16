import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssignmentOfferRow,
  AssignmentOfferStatus,
  Database,
} from "@/lib/database/types";

export async function listOffersForBooking(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<AssignmentOfferRow[]> {
  const { data, error } = await client
    .from("assignment_offers")
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function findOpenOfferForBookingCleaner(
  client: SupabaseClient<Database>,
  bookingId: string,
  cleanerId: string,
): Promise<AssignmentOfferRow | null> {
  const { data, error } = await client
    .from("assignment_offers")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("cleaner_id", cleanerId)
    .eq("status", "offered")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function listOffersForCleaner(
  client: SupabaseClient<Database>,
  cleanerId: string,
  statuses: readonly AssignmentOfferStatus[] = ["offered"],
): Promise<AssignmentOfferRow[]> {
  const { data, error } = await client
    .from("assignment_offers")
    .select("*")
    .eq("cleaner_id", cleanerId)
    .in("status", statuses)
    .order("offered_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getOfferById(
  client: SupabaseClient<Database>,
  offerId: string,
): Promise<AssignmentOfferRow | null> {
  const { data, error } = await client
    .from("assignment_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}
