import type { PricingFrequency } from "@/features/pricing/server/types";

export const RECURRING_SERIES_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;
export type RecurringSeriesFrequency = (typeof RECURRING_SERIES_FREQUENCIES)[number];

export const BOOKING_SERIES_STATUSES = ["active", "paused", "cancelled"] as const;
export type BookingSeriesStatus = (typeof BOOKING_SERIES_STATUSES)[number];

/** Default horizon for generating unpaid child occurrences ahead of schedule. */
export const RECURRING_GENERATION_HORIZON_DAYS = 45;

export function isRecurringSeriesFrequency(
  value: string,
): value is RecurringSeriesFrequency {
  return (RECURRING_SERIES_FREQUENCIES as readonly string[]).includes(value);
}

export function pricingFrequencyToSeriesFrequency(
  frequency: PricingFrequency,
): RecurringSeriesFrequency | null {
  if (frequency === "once") return null;
  return frequency;
}
