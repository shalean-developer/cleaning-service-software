import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { Database } from "@/lib/database/types";
import { findScheduleGroupById, updateScheduleGroupStatus } from "./recurringScheduleGroupRepository";
import {
  cancelEntireBookingSeries,
  pauseBookingSeries,
  resumeBookingSeries,
} from "./seriesActions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function pauseRecurringScheduleGroup(
  client: SupabaseClient<Database>,
  groupId: string,
): Promise<void> {
  const group = await findScheduleGroupById(client, groupId);
  if (!group) throw new Error("Schedule group not found.");
  await updateScheduleGroupStatus(client, groupId, "paused");
  const { data: seriesRows, error } = await client
    .from("booking_series")
    .select("id, status")
    .eq("group_id", groupId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  for (const row of seriesRows ?? []) {
    await pauseBookingSeries(client, row.id as string);
  }
}

export async function resumeRecurringScheduleGroup(
  client: SupabaseClient<Database>,
  groupId: string,
): Promise<void> {
  const group = await findScheduleGroupById(client, groupId);
  if (!group) throw new Error("Schedule group not found.");
  await updateScheduleGroupStatus(client, groupId, "active");
  const { data: seriesRows, error } = await client
    .from("booking_series")
    .select("id, status")
    .eq("group_id", groupId)
    .eq("status", "paused");
  if (error) throw new Error(error.message);
  for (const row of seriesRows ?? []) {
    await resumeBookingSeries(client, row.id as string);
  }
}

export async function cancelRecurringScheduleGroup(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  groupId: string,
  actor: { actorType: "admin"; profileId: string },
): Promise<{ cancelledBookings: number }> {
  const group = await findScheduleGroupById(client, groupId);
  if (!group) throw new Error("Schedule group not found.");
  await updateScheduleGroupStatus(client, groupId, "cancelled");

  const { data: seriesRows, error } = await client
    .from("booking_series")
    .select("id")
    .eq("group_id", groupId);
  if (error) throw new Error(error.message);

  let cancelledBookings = 0;
  for (const row of seriesRows ?? []) {
    const result = await cancelEntireBookingSeries(client, backend, row.id as string, actor);
    cancelledBookings += result.cancelledBookings;
  }
  return { cancelledBookings };
}

export async function loadScheduleGroupForAdmin(groupId: string) {
  const client = await createSupabaseServerClient();
  if (!client) return { ok: false as const, message: "Database unavailable." };
  const group = await findScheduleGroupById(client, groupId);
  if (!group) return { ok: false as const, message: "Schedule group not found." };
  return { ok: true as const, client, group };
}
