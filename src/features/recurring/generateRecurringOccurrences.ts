import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingSeriesRow, Database } from "@/lib/database/types";
import {
  findBookingOccurrenceAt,
  findSeriesById,
  updateSeriesNextOccurrence,
} from "./bookingSeriesRepository";
import {
  bookingDurationMs,
  computeNextOccurrenceAfter,
  scheduledEndForStart,
} from "./recurrenceDateEngine";
import { RECURRING_GENERATION_HORIZON_DAYS } from "./types";

const MS_PER_DAY = 86_400_000;

export type GenerateRecurringOccurrencesResult = {
  seriesScanned: number;
  created: number;
  skippedExisting: number;
  skippedAnchor: number;
  skippedPaused: number;
  skippedCancelled: number;
  errors: number;
  errorMessages: string[];
};

function buildOccurrenceMetadata(
  series: BookingSeriesRow,
  scheduledStart: string,
): Record<string, unknown> {
  const template =
    series.template_metadata != null &&
    typeof series.template_metadata === "object" &&
    !Array.isArray(series.template_metadata)
      ? { ...(series.template_metadata as Record<string, unknown>) }
      : {};
  return {
    ...template,
    recurring: {
      generated: true,
      seriesId: series.id,
      frequency: series.frequency,
      scheduledStart,
    },
  };
}

export async function generateRecurringOccurrencesForSeries(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  seriesId: string,
  options: { horizonDays?: number; now?: Date } = {},
): Promise<GenerateRecurringOccurrencesResult> {
  const result: GenerateRecurringOccurrencesResult = {
    seriesScanned: 1,
    created: 0,
    skippedExisting: 0,
    skippedAnchor: 0,
    skippedPaused: 0,
    skippedCancelled: 0,
    errors: 0,
    errorMessages: [],
  };

  const series = await findSeriesById(client, seriesId);
  if (!series) return result;
  if (series.status === "paused") {
    result.skippedPaused += 1;
    return result;
  }
  if (series.status === "cancelled") {
    result.skippedCancelled += 1;
    return result;
  }

  const now = options.now ?? new Date();
  const horizonEndIso = new Date(
    now.getTime() + (options.horizonDays ?? RECURRING_GENERATION_HORIZON_DAYS) * MS_PER_DAY,
  ).toISOString();

  const templateMeta =
    series.template_metadata != null &&
    typeof series.template_metadata === "object" &&
    !Array.isArray(series.template_metadata)
      ? (series.template_metadata as Record<string, unknown>)
      : {};
  const anchorEnd =
    typeof templateMeta.anchorScheduledEnd === "string"
      ? templateMeta.anchorScheduledEnd
      : null;
  const durationMs = anchorEnd
    ? bookingDurationMs(series.anchor_scheduled_start, anchorEnd)
    : bookingDurationMs(series.anchor_scheduled_start, series.anchor_scheduled_start) ||
      3 * 60 * 60 * 1000;

  let cursor =
    series.next_occurrence_at ??
    computeNextOccurrenceAfter(series.frequency, series.anchor_scheduled_start);

  let lastPlanned: string | null = null;

  while (new Date(cursor).getTime() <= new Date(horizonEndIso).getTime()) {
    if (cursor === series.anchor_scheduled_start) {
      result.skippedAnchor += 1;
      cursor = computeNextOccurrenceAfter(series.frequency, cursor);
      continue;
    }

    const existing = await findBookingOccurrenceAt(client, series.id, cursor);
    if (existing) {
      result.skippedExisting += 1;
    } else {
      const scheduledEnd = scheduledEndForStart(cursor, durationMs);
      const idempotencyKey = `recurring:${series.id}:${cursor}`;
      const cmdResult = await executeBookingCommand(backend, {
        type: "CREATE_RECURRING_OCCURRENCE",
        actor: { actorType: "service", profileId: null },
        customerId: series.customer_id,
        seriesId: series.id,
        scheduledStart: cursor,
        scheduledEnd,
        priceCents: series.price_cents,
        currency: "ZAR",
        metadata: buildOccurrenceMetadata(series, cursor),
        idempotencyKey,
        reason: "Recurring occurrence generated",
      });
      if (cmdResult.ok) {
        result.created += 1;
      } else {
        result.errors += 1;
        result.errorMessages.push(
          `series=${series.id} slot=${cursor}: ${cmdResult.message ?? "CREATE_RECURRING_OCCURRENCE failed"}`,
        );
      }
    }

    lastPlanned = cursor;
    cursor = computeNextOccurrenceAfter(series.frequency, cursor);
  }

  const nextPointer =
    lastPlanned != null
      ? computeNextOccurrenceAfter(series.frequency, lastPlanned)
      : series.next_occurrence_at;

  await updateSeriesNextOccurrence(client, series.id, nextPointer);

  return result;
}

export async function generateRecurringOccurrences(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  options: { seriesId?: string; limit?: number; horizonDays?: number } = {},
): Promise<GenerateRecurringOccurrencesResult> {
  const totals: GenerateRecurringOccurrencesResult = {
    seriesScanned: 0,
    created: 0,
    skippedExisting: 0,
    skippedAnchor: 0,
    skippedPaused: 0,
    skippedCancelled: 0,
    errors: 0,
    errorMessages: [],
  };

  if (options.seriesId) {
    return generateRecurringOccurrencesForSeries(client, backend, options.seriesId, {
      horizonDays: options.horizonDays,
    });
  }

  const { listActiveSeriesForGeneration } = await import("./bookingSeriesRepository");
  const rows = await listActiveSeriesForGeneration(client, options.limit ?? 100);
  totals.seriesScanned = rows.length;

  for (const row of rows) {
    const partial = await generateRecurringOccurrencesForSeries(client, backend, row.id, {
      horizonDays: options.horizonDays,
    });
    totals.created += partial.created;
    totals.skippedExisting += partial.skippedExisting;
    totals.skippedAnchor += partial.skippedAnchor;
    totals.skippedPaused += partial.skippedPaused;
    totals.skippedCancelled += partial.skippedCancelled;
    totals.errors += partial.errors;
    totals.errorMessages.push(...partial.errorMessages);
  }

  return totals;
}
