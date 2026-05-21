import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { WIZARD_TIMEZONE } from "@/features/booking-wizard/constants";
import type { BookingRow, Database } from "@/lib/database/types";
import {
  findSeriesByCreatedFromBookingId,
  insertBookingSeries,
  linkBookingToSeries,
  resolveCustomerProfileId,
} from "./bookingSeriesRepository";
import { computeNextOccurrenceAfter } from "./recurrenceDateEngine";
import {
  readSeriesFrequencyFromBookingMetadata,
  readServiceSlugFromBookingMetadata,
} from "./readBookingCadence";
import {
  readSelectedDaysFromBookingMetadata,
  weekdayFromJohannesburgInstant,
} from "./recurringScheduleDays";
import { materializeRecurringScheduleGroupFromBooking } from "./materializeRecurringScheduleGroup";

export type MaterializeRecurringSeriesResult =
  | { ok: true; materialized: false; reason: "once_off" | "already_linked" | "series_exists" | "schedule_group" }
  | { ok: true; materialized: true; seriesId: string; idempotent: boolean; groupId?: string }
  | { ok: false; code: "INVALID_METADATA" | "PERSISTENCE_ERROR"; message: string };

/**
 * Creates `booking_series` after the first paid visit when cadence is weekly/biweekly/monthly.
 * Idempotent for webhook/verify races via unique `created_from_booking_id`.
 */
export async function materializeRecurringSeriesFromBooking(
  client: SupabaseClient<Database>,
  booking: BookingRow,
  options?: { backend?: import("@/features/bookings/server/commands/bookingCommandBackend").BookingCommandBackend },
): Promise<MaterializeRecurringSeriesResult> {
  if (booking.series_id) {
    return { ok: true, materialized: false, reason: "already_linked" };
  }

  if (options?.backend) {
    const groupAttempt = await materializeRecurringScheduleGroupFromBooking(
      client,
      options.backend,
      booking,
    );
    if (groupAttempt.ok && groupAttempt.materialized) {
      return {
        ok: true,
        materialized: true,
        seriesId: groupAttempt.seriesIds[0] ?? "",
        idempotent: groupAttempt.idempotent,
        groupId: groupAttempt.groupId,
      };
    }
    if (groupAttempt.ok && !groupAttempt.materialized && groupAttempt.reason !== "not_multi_day") {
      return { ok: true, materialized: false, reason: "schedule_group" };
    }
    if (!groupAttempt.ok) {
      return { ok: false, code: groupAttempt.code, message: groupAttempt.message };
    }
  }

  const existing = await findSeriesByCreatedFromBookingId(client, booking.id);
  if (existing) {
    await linkBookingToSeries(client, booking.id, existing.id);
    return { ok: true, materialized: true, seriesId: existing.id, idempotent: true };
  }

  const frequency = readSeriesFrequencyFromBookingMetadata(booking.metadata);
  if (!frequency) {
    return { ok: true, materialized: false, reason: "once_off" };
  }

  const serviceSlug = readServiceSlugFromBookingMetadata(booking.metadata);
  if (!serviceSlug) {
    return {
      ok: false,
      code: "INVALID_METADATA",
      message: "Booking metadata is missing service slug for recurring series.",
    };
  }

  const userId = await resolveCustomerProfileId(client, booking.customer_id);
  const nextOccurrenceAt = computeNextOccurrenceAfter(frequency, booking.scheduled_start);
  const selectedDays = readSelectedDaysFromBookingMetadata(booking.metadata);
  const weekday =
    selectedDays?.[0] ?? weekdayFromJohannesburgInstant(booking.scheduled_start);

  const templateMetadata = {
    ...(booking.metadata != null &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : {}),
    anchorScheduledEnd: booking.scheduled_end,
  };

  try {
    const series = await insertBookingSeries(client, {
      customerId: booking.customer_id,
      userId,
      createdFromBookingId: booking.id,
      frequency,
      timezone: WIZARD_TIMEZONE,
      anchorScheduledStart: booking.scheduled_start,
      nextOccurrenceAt,
      templateMetadata,
      serviceSlug,
      priceCents: booking.price_cents,
      weekday,
      slotLabel: frequency === "monthly" ? null : undefined,
    });
    await linkBookingToSeries(client, booking.id, series.id);
    return { ok: true, materialized: true, seriesId: series.id, idempotent: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not materialize booking series.";
    if (
      message.includes("booking_series_created_from_booking_unique") ||
      message.includes("duplicate key") ||
      message.includes("23505")
    ) {
      const raced = await findSeriesByCreatedFromBookingId(client, booking.id);
      if (raced) {
        await linkBookingToSeries(client, booking.id, raced.id);
        return { ok: true, materialized: true, seriesId: raced.id, idempotent: true };
      }
    }
    return { ok: false, code: "PERSISTENCE_ERROR", message };
  }
}
