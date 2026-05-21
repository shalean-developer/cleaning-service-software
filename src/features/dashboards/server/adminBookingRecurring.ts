import type { Json } from "@/lib/database/types";

export { readBookingFrequencyFromMetadata } from "@/features/recurring/readBookingCadence";

/** True only when a booking is linked to a materialized series (`series_id`). */
export function isSeriesLinkedAdminBooking(seriesId: string | null | undefined): boolean {
  return Boolean(seriesId);
}

/**
 * Admin "recurring" flag — series-linked bookings only.
 * Metadata cadence (weekly/monthly) is not treated as an active recurring series.
 */
export function isRecurringAdminBooking(input: {
  seriesId?: string | null;
  metadata?: Json;
}): boolean {
  return isSeriesLinkedAdminBooking(input.seriesId);
}

/** Active recurring series count for overview metrics (no metadata-only inflation). */
export function computeRecurringActiveCount(seriesLinkedCount: number | null | undefined): number {
  return seriesLinkedCount ?? 0;
}
