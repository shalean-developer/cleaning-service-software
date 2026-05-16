import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { findLockByBookingId } from "@/features/bookings/server/lock/lockRepository";
import type { CleanerPreferenceLock } from "@/features/bookings/server/lock/types";
import { BOOKING_LOCK_TIMEZONE } from "@/features/bookings/server/lock/constants";
import type { BookingRow, Database } from "@/lib/database/types";
import type { PricingInput } from "@/features/pricing/server/types";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { isServiceSlug } from "@/features/pricing/server/catalog";
import type { AssignmentContext } from "./types";

function cleanerPreferenceFromMetadata(
  metadata: Record<string, unknown>,
): CleanerPreferenceLock {
  const modeRaw = metadata.cleanerPreferenceMode;
  const preferred =
    typeof metadata.preferred_cleaner_id === "string"
      ? metadata.preferred_cleaner_id
      : null;

  if (modeRaw === "selected" && preferred) {
    return { mode: "selected", selectedCleanerId: preferred };
  }
  return { mode: "best_available", selectedCleanerId: null };
}

function pricingInputFromMetadata(
  metadata: Record<string, unknown>,
  serviceSlug: string,
  booking: BookingRow,
): PricingInput | null {
  const quote = metadata.quote;
  if (quote != null && typeof quote === "object" && !Array.isArray(quote)) {
    const q = quote as Record<string, unknown>;
    const input = q.input;
    if (input != null && typeof input === "object" && !Array.isArray(input)) {
      const i = input as Record<string, unknown>;
      const slug = typeof i.serviceSlug === "string" ? i.serviceSlug : serviceSlug;
      if (!isServiceSlug(slug)) return null;
      return {
        serviceSlug: slug,
        bedrooms: typeof i.bedrooms === "number" ? i.bedrooms : 2,
        bathrooms: typeof i.bathrooms === "number" ? i.bathrooms : 1,
        propertySizeSqm:
          typeof i.propertySizeSqm === "number" ? i.propertySizeSqm : undefined,
        frequency:
          i.frequency === "weekly" || i.frequency === "biweekly"
            ? i.frequency
            : "once",
        addons: Array.isArray(i.addons) ? (i.addons as PricingInput["addons"]) : undefined,
        teamSize: 1,
      };
    }
  }

  if (!isServiceSlug(serviceSlug)) return null;
  return {
    serviceSlug,
    bedrooms: 2,
    bathrooms: 1,
    teamSize: 1,
  };
}

export async function loadAssignmentContext(
  client: SupabaseClient<Database>,
  booking: BookingRow,
): Promise<AssignmentContext | null> {
  const lock = await findLockByBookingId(client, booking.id);

  if (lock) {
    const pref = lock.locked_cleaner_preference as CleanerPreferenceLock;
    const lockedMeta =
      lock.locked_metadata != null &&
      typeof lock.locked_metadata === "object" &&
      !Array.isArray(lock.locked_metadata)
        ? (lock.locked_metadata as Record<string, unknown>)
        : {};

    const pricingInput =
      pricingInputFromMetadata(lockedMeta, lock.locked_service_slug, booking) ?? {
        serviceSlug: lock.locked_service_slug as ServiceSlug,
        bedrooms: 2,
        bathrooms: 1,
        teamSize: 1,
      };

    return {
      bookingId: booking.id,
      scheduledStart: lock.locked_schedule_start,
      scheduledEnd: lock.locked_schedule_end,
      scheduleTimezone: lock.locked_schedule_timezone,
      areaSlug: lock.locked_area_slug,
      serviceSlug: lock.locked_service_slug,
      pricingInput,
      cleanerPreference: pref,
      preferredCleanerId:
        pref.mode === "selected" ? pref.selectedCleanerId : null,
    };
  }

  const metadata =
    booking.metadata != null &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : {};

  const areaSlug =
    typeof metadata.areaSlug === "string"
      ? metadata.areaSlug
      : typeof metadata.suburb === "string"
        ? metadata.suburb
        : "";

  const serviceSlug =
    typeof metadata.serviceSlug === "string"
      ? metadata.serviceSlug
      : "regular-cleaning";

  const pricingInput = pricingInputFromMetadata(metadata, serviceSlug, booking);
  if (!pricingInput || !areaSlug) return null;

  const cleanerPreference = cleanerPreferenceFromMetadata(metadata);

  return {
    bookingId: booking.id,
    scheduledStart: booking.scheduled_start,
    scheduledEnd: booking.scheduled_end,
    scheduleTimezone:
      typeof metadata.timezone === "string"
        ? metadata.timezone
        : BOOKING_LOCK_TIMEZONE,
    areaSlug,
    serviceSlug: pricingInput.serviceSlug,
    pricingInput,
    cleanerPreference,
    preferredCleanerId:
      cleanerPreference.mode === "selected"
        ? cleanerPreference.selectedCleanerId
        : null,
  };
}
