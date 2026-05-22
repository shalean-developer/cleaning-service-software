import "server-only";

import { isOfferPastExpiry } from "@/features/assignments/server/buildOfferExpiry";
import {
  formatScheduleRange,
  parseBookingDisplay,
  type BookingDisplayFields,
} from "@/features/dashboards/server/parseBookingDisplay";
import {
  EARNINGS_BEING_CALCULATED_LABEL,
  resolveCleanerEarningsDisplay,
} from "@/features/dashboards/server/resolveCleanerEarningsDisplay";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssignmentOfferRow, Database } from "@/lib/database/types";

export type AssignmentOfferNotificationContext = {
  offer: AssignmentOfferRow;
  serviceLabel: string;
  scheduleLabel: string;
  locationLabel: string;
  earningsLabel: string | null;
  expiresAtLabel: string | null;
};

export const OFFER_EMAIL_AREA_FALLBACK = "Area available in dashboard" as const;

const GENERIC_OFFER_LOCATION_VALUES = new Set([
  "street",
  "test",
  "testing",
  "tbd",
  "n/a",
  "na",
  "unknown",
  "placeholder",
  "sample",
  "address",
  "line1",
  "line 1",
]);

function normalizeOfferLocationPart(value: string): string {
  return value.trim().toLowerCase();
}

/** True when a suburb/city value is empty or unsuitable for cleaner offer email copy. */
export function isGenericOfferLocationPart(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  const normalized = normalizeOfferLocationPart(value);
  if (GENERIC_OFFER_LOCATION_VALUES.has(normalized)) return true;
  if (/^street\s*\d*$/i.test(normalized)) return true;
  return false;
}

/** Suburb/city only. no street line; safe fallback for missing or test placeholders. */
export function formatOfferLocationForEmail(display: BookingDisplayFields): string {
  const addressLine = display.addressLine?.trim() || null;
  const suburbRaw = display.suburb?.trim() || null;
  const cityRaw = display.city?.trim() || null;

  const suburb =
    suburbRaw &&
    !isGenericOfferLocationPart(suburbRaw) &&
    suburbRaw !== addressLine
      ? suburbRaw
      : null;
  const city =
    cityRaw && !isGenericOfferLocationPart(cityRaw) && cityRaw !== addressLine ? cityRaw : null;

  const parts: string[] = [];
  if (suburb) parts.push(suburb);
  if (city && city !== suburb) parts.push(city);

  if (parts.length === 0) {
    return OFFER_EMAIL_AREA_FALLBACK;
  }

  const label = parts.join(", ");
  if (/^street,\s*street$/i.test(label)) {
    return OFFER_EMAIL_AREA_FALLBACK;
  }

  return label;
}

export function formatOfferExpiryLabel(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  return new Date(expiresAt).toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function resolveOfferEarningsLabelForEmail(
  metadata: import("@/lib/database/types").Json | null,
  priceCents: number,
  currency: string,
): string | null {
  const earnings = resolveCleanerEarningsDisplay({
    currency,
    metadata,
    price_cents: priceCents,
    cleaner_id: null,
    earningLines: [],
  });

  if (earnings.earningsLabel === EARNINGS_BEING_CALCULATED_LABEL) {
    return null;
  }

  return earnings.earningsLabel;
}

/**
 * Loads offer + booking display fields for assignment_offer email (service role).
 */
export async function loadAssignmentOfferNotificationContext(
  client: SupabaseClient<Database>,
  offerId: string,
  bookingId: string,
): Promise<
  | { ok: true; context: AssignmentOfferNotificationContext }
  | { ok: false; code: "OFFER_NOT_FOUND" | "BOOKING_NOT_FOUND" }
> {
  const { data: offer, error: offerError } = await client
    .from("assignment_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();

  if (offerError || !offer) {
    return { ok: false, code: "OFFER_NOT_FOUND" };
  }

  if (offer.booking_id !== bookingId) {
    return { ok: false, code: "OFFER_NOT_FOUND" };
  }

  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("id, status, scheduled_start, scheduled_end, price_cents, currency, metadata, cleaner_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return { ok: false, code: "BOOKING_NOT_FOUND" };
  }

  const display = parseBookingDisplay(booking.metadata);

  return {
    ok: true,
    context: {
      offer,
      serviceLabel: display.serviceLabel,
      scheduleLabel: formatScheduleRange(booking.scheduled_start, booking.scheduled_end),
      locationLabel: formatOfferLocationForEmail(display),
      earningsLabel: resolveOfferEarningsLabelForEmail(
        booking.metadata,
        booking.price_cents,
        booking.currency,
      ),
      expiresAtLabel: formatOfferExpiryLabel(offer.expires_at),
    },
  };
}

export { isOfferPastExpiry };
