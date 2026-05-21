import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { Database } from "@/lib/database/types";
import {
  findSeriesById,
  updateSeriesNextOccurrence,
  updateSeriesStatus,
} from "./bookingSeriesRepository";
import { computeNextOccurrenceAfter } from "./recurrenceDateEngine";
import type { BookingSeriesStatus } from "./types";

/** Cancel a single generated occurrence (not the anchor paid visit unless explicitly targeted). */
export async function cancelRecurringOccurrence(
  backend: BookingCommandBackend,
  bookingId: string,
  actor: { actorType: "customer" | "admin"; profileId: string | null },
  ctx?: import("@/features/bookings/server/commands/executeBookingCommand").BookingCommandRunContext,
): Promise<ReturnType<typeof executeBookingCommand>> {
  return executeBookingCommand(
    backend,
    {
      type: "CANCEL_BOOKING",
      actor,
      bookingId,
      reason: "Recurring occurrence cancelled",
    },
    ctx,
  );
}

export async function setBookingSeriesStatus(
  client: SupabaseClient<Database>,
  seriesId: string,
  status: BookingSeriesStatus,
): Promise<void> {
  await updateSeriesStatus(client, seriesId, status);
}

export async function pauseBookingSeries(
  client: SupabaseClient<Database>,
  seriesId: string,
): Promise<void> {
  await setBookingSeriesStatus(client, seriesId, "paused");
}

/** Advance `next_occurrence_at` forward until it is strictly after `now`. */
export function resolveNextOccurrenceAfterNow(
  frequency: import("./types").RecurringSeriesFrequency,
  anchorScheduledStart: string,
  currentNext: string | null,
  now: Date = new Date(),
): string {
  let cursor = currentNext ?? computeNextOccurrenceAfter(frequency, anchorScheduledStart);
  const nowMs = now.getTime();
  let guard = 0;
  while (new Date(cursor).getTime() <= nowMs && guard < 64) {
    cursor = computeNextOccurrenceAfter(frequency, cursor);
    guard += 1;
  }
  return cursor;
}

export async function resumeBookingSeries(
  client: SupabaseClient<Database>,
  seriesId: string,
): Promise<void> {
  const series = await findSeriesById(client, seriesId);
  if (!series) throw new Error("Series not found.");
  await setBookingSeriesStatus(client, seriesId, "active");
  const next = resolveNextOccurrenceAfterNow(
    series.frequency,
    series.anchor_scheduled_start,
    series.next_occurrence_at,
  );
  await updateSeriesNextOccurrence(client, seriesId, next);
}

/** Cancel the next unpaid generated visit and advance `next_occurrence_at`. */
export async function skipNextRecurringOccurrence(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  seriesId: string,
  actor: { actorType: "admin"; profileId: string },
): Promise<{ skippedBookingId: string | null; nextOccurrenceAt: string | null }> {
  const series = await findSeriesById(client, seriesId);
  if (!series) throw new Error("Series not found.");
  if (series.status !== "active") {
    throw new Error("Only active series can skip the next occurrence.");
  }

  const unpaidStatuses = ["pending_payment", "draft", "payment_failed"] as const;
  let skippedBookingId: string | null = null;

  if (series.next_occurrence_at) {
    const { data: atNext } = await client
      .from("bookings")
      .select("id, status")
      .eq("series_id", seriesId)
      .eq("scheduled_start", series.next_occurrence_at)
      .maybeSingle();

    if (atNext && unpaidStatuses.includes(atNext.status as (typeof unpaidStatuses)[number])) {
      const result = await cancelRecurringOccurrence(backend, atNext.id as string, actor);
      if (result.ok) skippedBookingId = atNext.id as string;
    }
  }

  if (!skippedBookingId) {
    const { data: earliest } = await client
      .from("bookings")
      .select("id, status, scheduled_start")
      .eq("series_id", seriesId)
      .in("status", [...unpaidStatuses])
      .gte("scheduled_start", new Date().toISOString())
      .order("scheduled_start", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (earliest) {
      const result = await cancelRecurringOccurrence(backend, earliest.id as string, actor);
      if (result.ok) skippedBookingId = earliest.id as string;
    }
  }

  const advanceFrom = series.next_occurrence_at ?? series.anchor_scheduled_start;
  const nextOccurrenceAt = computeNextOccurrenceAfter(series.frequency, advanceFrom);
  await updateSeriesNextOccurrence(client, seriesId, nextOccurrenceAt);

  return { skippedBookingId, nextOccurrenceAt };
}

/** Cancel series and all unpaid future child occurrences. Paid anchor visit is unchanged. */
export async function cancelEntireBookingSeries(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  seriesId: string,
  actor: { actorType: "admin"; profileId: string },
): Promise<{ cancelledBookings: number }> {
  await setBookingSeriesStatus(client, seriesId, "cancelled");

  const { data: children, error } = await client
    .from("bookings")
    .select("id, status")
    .eq("series_id", seriesId)
    .in("status", ["pending_payment", "draft", "payment_failed"]);

  if (error) throw new Error(error.message);

  let cancelledBookings = 0;
  for (const row of children ?? []) {
    const result = await executeBookingCommand(backend, {
      type: "CANCEL_BOOKING",
      actor,
      bookingId: row.id as string,
      reason: "Recurring series cancelled",
    });
    if (result.ok) cancelledBookings += 1;
  }

  await updateSeriesNextOccurrence(client, seriesId, null);
  return { cancelledBookings };
}

export async function rescheduleSeriesNextOccurrence(
  client: SupabaseClient<Database>,
  seriesId: string,
  nextScheduledStartIso: string,
): Promise<void> {
  const series = await findSeriesById(client, seriesId);
  if (!series) throw new Error("Series not found.");
  await updateSeriesNextOccurrence(client, seriesId, nextScheduledStartIso);
}

