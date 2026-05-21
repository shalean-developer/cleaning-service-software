#!/usr/bin/env node
/**
 * Backfill booking_series for paid anchor visits that predate post-payment materialization.
 *
 * Usage:
 *   npm run ops:repair:recurring-series
 *   CONFIRM_REPAIR_RECURRING_SERIES=yes npm run ops:repair:recurring-series -- --apply
 *   CONFIRM_REPAIR_RECURRING_SERIES=yes npm run ops:repair:recurring-series -- --apply --booking-id=<uuid>
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvFiles, requireServiceRoleClient } from "../e2e/lib/env.mjs";
import {
  computeNextOccurrenceAfter,
  findPaidMetadataNoSeriesBookings,
  readServiceSlugFromBookingMetadata,
  seriesFrequencyFromPricing,
  readBookingFrequencyFromMetadata,
} from "./lib/recurring-cadence.mjs";

const WIZARD_TIMEZONE = "Africa/Johannesburg";
const args = process.argv.slice(2);
const applyRequested = args.includes("--apply");
const confirmed = process.env.CONFIRM_REPAIR_RECURRING_SERIES === "yes";
const bookingIdArg = args.find((a) => a.startsWith("--booking-id="));
const onlyBookingId = bookingIdArg ? bookingIdArg.split("=")[1] : null;

loadEnvFiles();
const client = requireServiceRoleClient(createClient);

async function resolveCustomerProfileId(customerId) {
  const { data, error } = await client
    .from("customers")
    .select("profile_id")
    .eq("id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data?.profile_id ?? null;
}

async function materializeBooking(booking, dryRun) {
  if (booking.series_id) {
    return { action: "skip", reason: "already_linked" };
  }

  const { data: existingSeries } = await client
    .from("booking_series")
    .select("id")
    .eq("created_from_booking_id", booking.id)
    .maybeSingle();

  if (existingSeries) {
    if (dryRun) {
      return {
        action: "would_link",
        seriesId: existingSeries.id,
        reason: "series_exists_unlinked",
      };
    }
    const { error } = await client
      .from("bookings")
      .update({ series_id: existingSeries.id, updated_at: new Date().toISOString() })
      .eq("id", booking.id);
    if (error) throw error;
    return { action: "linked", seriesId: existingSeries.id, reason: "series_exists_unlinked" };
  }

  const pricingFreq = readBookingFrequencyFromMetadata(booking.metadata);
  const frequency = seriesFrequencyFromPricing(pricingFreq);
  if (!frequency) {
    return { action: "skip", reason: "once_off" };
  }

  const serviceSlug = readServiceSlugFromBookingMetadata(booking.metadata);
  if (!serviceSlug) {
    return { action: "error", reason: "missing_service_slug" };
  }

  const nextOccurrenceAt = computeNextOccurrenceAfter(frequency, booking.scheduled_start);
  const templateMetadata = {
    ...(booking.metadata != null &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? booking.metadata
      : {}),
    anchorScheduledEnd: booking.scheduled_end,
  };

  if (dryRun) {
    return {
      action: "would_create",
      frequency,
      serviceSlug,
      nextOccurrenceAt,
    };
  }

  const userId = await resolveCustomerProfileId(booking.customer_id);
  const now = new Date().toISOString();
  const { data: series, error: insertError } = await client
    .from("booking_series")
    .insert({
      customer_id: booking.customer_id,
      user_id: userId,
      created_from_booking_id: booking.id,
      frequency,
      timezone: WIZARD_TIMEZONE,
      anchor_scheduled_start: booking.scheduled_start,
      next_occurrence_at: nextOccurrenceAt,
      status: "active",
      template_metadata: templateMetadata,
      service_slug: serviceSlug,
      price_cents: booking.price_cents,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced } = await client
        .from("booking_series")
        .select("id")
        .eq("created_from_booking_id", booking.id)
        .maybeSingle();
      if (raced) {
        await client
          .from("bookings")
          .update({ series_id: raced.id, updated_at: now })
          .eq("id", booking.id);
        return { action: "linked", seriesId: raced.id, reason: "race_idempotent" };
      }
    }
    throw insertError;
  }

  const { error: linkError } = await client
    .from("bookings")
    .update({ series_id: series.id, updated_at: now })
    .eq("id", booking.id);
  if (linkError) throw linkError;

  return { action: "created", seriesId: series.id, nextOccurrenceAt };
}

async function main() {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Recurring series backfill (PAID_METADATA_NO_SERIES)

  npm run ops:repair:recurring-series
  CONFIRM_REPAIR_RECURRING_SERIES=yes npm run ops:repair:recurring-series -- --apply
  CONFIRM_REPAIR_RECURRING_SERIES=yes npm run ops:repair:recurring-series -- --apply --booking-id=<uuid>

After apply, run cron generate-recurring-occurrences or wait for scheduled job.`);
    return;
  }

  if (applyRequested && !confirmed) {
    console.error(
      "Error: --apply requires CONFIRM_REPAIR_RECURRING_SERIES=yes\n" +
        "  CONFIRM_REPAIR_RECURRING_SERIES=yes npm run ops:repair:recurring-series -- --apply",
    );
    process.exit(1);
  }

  const dryRun = !applyRequested || !confirmed;
  console.log(dryRun ? "Recurring series backfill (dry-run)\n" : "Recurring series backfill (apply)\n");

  let query = client.from("bookings").select(
    "id, customer_id, status, series_id, scheduled_start, scheduled_end, price_cents, metadata",
  );
  if (onlyBookingId) {
    query = query.eq("id", onlyBookingId);
  }
  const { data: bookings, error } = await query;
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const candidates = onlyBookingId
    ? (bookings ?? [])
    : findPaidMetadataNoSeriesBookings(bookings);

  if (candidates.length === 0) {
    console.log("No PAID_METADATA_NO_SERIES bookings to backfill.");
    return;
  }

  for (const booking of candidates) {
    const result = await materializeBooking(booking, dryRun);
    console.log(
      `${dryRun ? "[dry-run]" : "[apply]"} booking ${booking.id} (${readBookingFrequencyFromMetadata(booking.metadata)}) → ${JSON.stringify(result)}`,
    );
  }

  if (dryRun) {
    console.log(
      "\nTo apply: CONFIRM_REPAIR_RECURRING_SERIES=yes npm run ops:repair:recurring-series -- --apply",
    );
  } else {
    console.log("\nRe-run: npm run ops:audit:recurring-bookings");
    console.log("Then trigger /api/cron/generate-recurring-occurrences for child visits.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
