import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingSeriesRow, Database, Json } from "@/lib/database/types";
import type { BookingSeriesStatus, RecurringSeriesFrequency } from "./types";

export type InsertBookingSeriesInput = {
  customerId: string;
  userId: string | null;
  createdFromBookingId: string;
  frequency: RecurringSeriesFrequency;
  timezone: string;
  anchorScheduledStart: string;
  nextOccurrenceAt: string | null;
  templateMetadata: Json;
  serviceSlug: string;
  priceCents: number;
  groupId?: string | null;
  weekday?: number | null;
  slotLabel?: string | null;
};

export async function findSeriesByCreatedFromBookingId(
  client: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingSeriesRow | null> {
  const { data, error } = await client
    .from("booking_series")
    .select("*")
    .eq("created_from_booking_id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BookingSeriesRow | null) ?? null;
}

export async function findSeriesById(
  client: SupabaseClient<Database>,
  seriesId: string,
): Promise<BookingSeriesRow | null> {
  const { data, error } = await client
    .from("booking_series")
    .select("*")
    .eq("id", seriesId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BookingSeriesRow | null) ?? null;
}

export async function insertBookingSeries(
  client: SupabaseClient<Database>,
  input: InsertBookingSeriesInput,
): Promise<BookingSeriesRow> {
  const now = new Date().toISOString();
  const row = {
    customer_id: input.customerId,
    user_id: input.userId,
    created_from_booking_id: input.createdFromBookingId,
    frequency: input.frequency,
    timezone: input.timezone,
    anchor_scheduled_start: input.anchorScheduledStart,
    next_occurrence_at: input.nextOccurrenceAt,
    status: "active" as const,
    template_metadata: input.templateMetadata,
    service_slug: input.serviceSlug,
    price_cents: input.priceCents,
    group_id: input.groupId ?? null,
    weekday: input.weekday ?? null,
    slot_label: input.slotLabel ?? null,
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await client.from("booking_series").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as BookingSeriesRow;
}

export async function linkBookingToSeries(
  client: SupabaseClient<Database>,
  bookingId: string,
  seriesId: string,
): Promise<void> {
  const { error } = await client
    .from("bookings")
    .update({ series_id: seriesId, updated_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (error) throw new Error(error.message);
}

export async function updateSeriesNextOccurrence(
  client: SupabaseClient<Database>,
  seriesId: string,
  nextOccurrenceAt: string | null,
): Promise<void> {
  const { error } = await client
    .from("booking_series")
    .update({ next_occurrence_at: nextOccurrenceAt, updated_at: new Date().toISOString() })
    .eq("id", seriesId);
  if (error) throw new Error(error.message);
}

export async function updateSeriesStatus(
  client: SupabaseClient<Database>,
  seriesId: string,
  status: BookingSeriesStatus,
): Promise<void> {
  const { error } = await client
    .from("booking_series")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", seriesId);
  if (error) throw new Error(error.message);
}

export async function countActiveBookingSeries(
  client: SupabaseClient<Database>,
): Promise<number> {
  const { count, error } = await client
    .from("booking_series")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listActiveSeriesForGeneration(
  client: SupabaseClient<Database>,
  limit = 100,
): Promise<BookingSeriesRow[]> {
  const { data, error } = await client
    .from("booking_series")
    .select("*")
    .eq("status", "active")
    .order("next_occurrence_at", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as BookingSeriesRow[];
}

export async function findBookingOccurrenceAt(
  client: SupabaseClient<Database>,
  seriesId: string,
  scheduledStart: string,
): Promise<{ id: string } | null> {
  const { data, error } = await client
    .from("bookings")
    .select("id")
    .eq("series_id", seriesId)
    .eq("scheduled_start", scheduledStart)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { id: data.id as string } : null;
}

export async function resolveCustomerProfileId(
  client: SupabaseClient<Database>,
  customerId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("customers")
    .select("profile_id")
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.profile_id ?? null;
}
