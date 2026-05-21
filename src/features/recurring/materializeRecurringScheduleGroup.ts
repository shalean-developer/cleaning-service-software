import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { WIZARD_TIMEZONE } from "@/features/booking-wizard/constants";
import type { BookingRow, Database } from "@/lib/database/types";
import {
  findSeriesByCreatedFromBookingId,
  insertBookingSeries,
  linkBookingToSeries,
  resolveCustomerProfileId,
} from "./bookingSeriesRepository";
import { computeNextOccurrenceAfter, bookingDurationMs } from "./recurrenceDateEngine";
import {
  readSeriesFrequencyFromBookingMetadata,
  readServiceSlugFromBookingMetadata,
} from "./readBookingCadence";
import {
  findScheduleGroupByAnchorBookingId,
  insertRecurringScheduleGroup,
  listSeriesIdsForGroup,
} from "./recurringScheduleGroupRepository";
import {
  formatSelectedDaysShort,
  normalizeSelectedDays,
  readSelectedDaysFromBookingMetadata,
  resolveSlotAnchorScheduledStart,
  shouldMaterializeScheduleGroup,
  slotLabelForWeekday,
  weekdayFromJohannesburgInstant,
} from "./recurringScheduleDays";
import type { RecurringSeriesFrequency } from "./types";

export type MaterializeScheduleGroupResult =
  | { ok: true; materialized: false; reason: "not_multi_day" | "already_linked" | "group_exists" }
  | {
      ok: true;
      materialized: true;
      groupId: string;
      seriesIds: string[];
      idempotent: boolean;
    }
  | { ok: false; code: "INVALID_METADATA" | "PERSISTENCE_ERROR"; message: string };

async function createSyntheticAnchorBooking(
  backend: BookingCommandBackend,
  input: {
    customerId: string;
    scheduledStart: string;
    scheduledEnd: string;
    priceCents: number;
    groupId: string;
    weekday: number;
    templateMetadata: Record<string, unknown>;
  },
): Promise<string> {
  const idempotencyKey = `synthetic-anchor:${input.groupId}:${input.weekday}:${input.scheduledStart}`;
  const result = await executeBookingCommand(backend, {
    type: "CREATE_SYNTHETIC_SERIES_ANCHOR",
    actor: { actorType: "service", profileId: null },
    customerId: input.customerId,
    scheduledStart: input.scheduledStart,
    scheduledEnd: input.scheduledEnd,
    priceCents: input.priceCents,
    currency: "ZAR",
    metadata: {
      ...input.templateMetadata,
      recurringSchedule: { syntheticAnchorForGroupId: input.groupId, weekday: input.weekday },
    },
    idempotencyKey,
    reason: "Synthetic cadence anchor for recurring weekday series",
  });
  if (!result.ok) {
    throw new Error(result.message ?? "Could not create synthetic anchor booking.");
  }
  return result.bookingId;
}

async function materializeSeriesForWeekday(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  input: {
    customerId: string;
    userId: string | null;
    groupId: string;
    frequency: RecurringSeriesFrequency;
    weekday: number;
    anchorBookingId: string;
    anchorScheduledStart: string;
    anchorScheduledEnd: string;
    templateMetadata: Record<string, unknown>;
    serviceSlug: string;
    priceCents: number;
    linkPaidBookingId?: string;
  },
): Promise<string> {
  const existing = await findSeriesByCreatedFromBookingId(client, input.anchorBookingId);
  if (existing) {
    if (input.linkPaidBookingId) {
      await linkBookingToSeries(client, input.linkPaidBookingId, existing.id);
    }
    return existing.id;
  }

  const nextOccurrenceAt = computeNextOccurrenceAfter(
    input.frequency,
    input.anchorScheduledStart,
  );

  const series = await insertBookingSeries(client, {
    customerId: input.customerId,
    userId: input.userId,
    createdFromBookingId: input.anchorBookingId,
    frequency: input.frequency,
    timezone: WIZARD_TIMEZONE,
    anchorScheduledStart: input.anchorScheduledStart,
    nextOccurrenceAt,
    templateMetadata: {
      ...input.templateMetadata,
      anchorScheduledEnd: input.anchorScheduledEnd,
    },
    serviceSlug: input.serviceSlug,
    priceCents: input.priceCents,
    groupId: input.groupId,
    weekday: input.weekday,
    slotLabel: slotLabelForWeekday(input.weekday),
  });

  if (input.linkPaidBookingId) {
    await linkBookingToSeries(client, input.linkPaidBookingId, series.id);
  }

  return series.id;
}

/**
 * Materializes a multi-day recurring_schedule_group and one booking_series per weekday.
 */
export async function materializeRecurringScheduleGroupFromBooking(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  booking: BookingRow,
): Promise<MaterializeScheduleGroupResult> {
  const frequency = readSeriesFrequencyFromBookingMetadata(booking.metadata);
  const selectedDays = readSelectedDaysFromBookingMetadata(booking.metadata);

  if (!shouldMaterializeScheduleGroup(frequency, selectedDays)) {
    return { ok: true, materialized: false, reason: "not_multi_day" };
  }

  const serviceSlug = readServiceSlugFromBookingMetadata(booking.metadata);
  if (!serviceSlug) {
    return {
      ok: false,
      code: "INVALID_METADATA",
      message: "Booking metadata is missing service slug for recurring schedule group.",
    };
  }

  const existingGroup = await findScheduleGroupByAnchorBookingId(client, booking.id);
  if (existingGroup) {
    const seriesIds = await listSeriesIdsForGroup(client, existingGroup.id);
    const paidWeekday = weekdayFromJohannesburgInstant(booking.scheduled_start);
    const paidSeries = await findSeriesByCreatedFromBookingId(client, booking.id);
    if (!paidSeries && seriesIds.length > 0) {
      const { data: seriesRows } = await client
        .from("booking_series")
        .select("id, weekday")
        .eq("group_id", existingGroup.id);
      const match = (seriesRows ?? []).find((s) => s.weekday === paidWeekday);
      if (match) await linkBookingToSeries(client, booking.id, match.id as string);
    } else if (paidSeries) {
      await linkBookingToSeries(client, booking.id, paidSeries.id);
    }
    return {
      ok: true,
      materialized: true,
      groupId: existingGroup.id,
      seriesIds,
      idempotent: true,
    };
  }

  const days = normalizeSelectedDays(selectedDays!);
  const groupFrequency = frequency as "weekly" | "biweekly";
  const templateBase =
    booking.metadata != null &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? { ...(booking.metadata as Record<string, unknown>) }
      : {};

  const durationMs =
    bookingDurationMs(booking.scheduled_start, booking.scheduled_end) ||
    3 * 60 * 60 * 1000;
  const paidWeekday = weekdayFromJohannesburgInstant(booking.scheduled_start);
  const userId = await resolveCustomerProfileId(client, booking.customer_id);

  try {
    const group = await insertRecurringScheduleGroup(client, {
      customerId: booking.customer_id,
      serviceSlug,
      frequency: groupFrequency,
      timezone: WIZARD_TIMEZONE,
      label: `${formatSelectedDaysShort(days)} recurring`,
      selectedDays: days,
      anchorBookingId: booking.id,
    });

    const seriesIds: string[] = [];

    for (const weekday of days) {
      const slotStart =
        weekday === paidWeekday
          ? booking.scheduled_start
          : resolveSlotAnchorScheduledStart(booking.scheduled_start, weekday);
      const slotEnd = new Date(
        new Date(slotStart).getTime() + durationMs,
      ).toISOString();

      let createdFromBookingId = booking.id;
      if (weekday !== paidWeekday) {
        createdFromBookingId = await createSyntheticAnchorBooking(backend, {
          customerId: booking.customer_id,
          scheduledStart: slotStart,
          scheduledEnd: slotEnd,
          priceCents: booking.price_cents,
          groupId: group.id,
          weekday,
          templateMetadata: templateBase,
        });
      }

      const seriesId = await materializeSeriesForWeekday(client, backend, {
        customerId: booking.customer_id,
        userId,
        groupId: group.id,
        frequency: groupFrequency,
        weekday,
        anchorBookingId: createdFromBookingId,
        anchorScheduledStart: slotStart,
        anchorScheduledEnd: slotEnd,
        templateMetadata: templateBase,
        serviceSlug,
        priceCents: booking.price_cents,
        linkPaidBookingId: weekday === paidWeekday ? booking.id : undefined,
      });
      seriesIds.push(seriesId);
    }

    return {
      ok: true,
      materialized: true,
      groupId: group.id,
      seriesIds,
      idempotent: false,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not materialize schedule group.";
    if (
      message.includes("recurring_schedule_groups_anchor_booking_unique") ||
      message.includes("duplicate key") ||
      message.includes("23505")
    ) {
      const raced = await findScheduleGroupByAnchorBookingId(client, booking.id);
      if (raced) {
        const seriesIds = await listSeriesIdsForGroup(client, raced.id);
        return {
          ok: true,
          materialized: true,
          groupId: raced.id,
          seriesIds,
          idempotent: true,
        };
      }
    }
    return { ok: false, code: "PERSISTENCE_ERROR", message };
  }
}
