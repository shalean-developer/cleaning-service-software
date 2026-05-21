import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, RecurringScheduleGroupRow } from "@/lib/database/types";

export type InsertRecurringScheduleGroupInput = {
  customerId: string;
  serviceSlug: string;
  frequency: "weekly" | "biweekly";
  timezone: string;
  label: string | null;
  selectedDays: number[];
  anchorBookingId: string;
};

export async function findScheduleGroupByAnchorBookingId(
  client: SupabaseClient<Database>,
  anchorBookingId: string,
): Promise<RecurringScheduleGroupRow | null> {
  const { data, error } = await client
    .from("recurring_schedule_groups")
    .select("*")
    .eq("anchor_booking_id", anchorBookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as RecurringScheduleGroupRow | null) ?? null;
}

export async function findScheduleGroupById(
  client: SupabaseClient<Database>,
  groupId: string,
): Promise<RecurringScheduleGroupRow | null> {
  const { data, error } = await client
    .from("recurring_schedule_groups")
    .select("*")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as RecurringScheduleGroupRow | null) ?? null;
}

export async function insertRecurringScheduleGroup(
  client: SupabaseClient<Database>,
  input: InsertRecurringScheduleGroupInput,
): Promise<RecurringScheduleGroupRow> {
  const now = new Date().toISOString();
  const row = {
    customer_id: input.customerId,
    service_slug: input.serviceSlug,
    status: "active" as const,
    frequency: input.frequency,
    timezone: input.timezone,
    label: input.label,
    selected_days: input.selectedDays,
    anchor_booking_id: input.anchorBookingId,
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await client
    .from("recurring_schedule_groups")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as RecurringScheduleGroupRow;
}

export async function updateScheduleGroupStatus(
  client: SupabaseClient<Database>,
  groupId: string,
  status: RecurringScheduleGroupRow["status"],
): Promise<void> {
  const { error } = await client
    .from("recurring_schedule_groups")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", groupId);
  if (error) throw new Error(error.message);
}

export async function listSeriesIdsForGroup(
  client: SupabaseClient<Database>,
  groupId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("booking_series")
    .select("id")
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id as string);
}
