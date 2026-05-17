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

/** Suburb/city only — no street line in offer emails. */
export function formatOfferLocationForEmail(display: BookingDisplayFields): string {
  const parts = [display.suburb, display.city].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
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
