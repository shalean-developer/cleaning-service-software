import type { PricingFrequency } from "@/features/pricing/server/types";
import { PRICING_FREQUENCIES } from "@/features/pricing/server/types";
import type { Json } from "@/lib/database/types";

export function readBookingFrequencyFromMetadata(metadata: Json): PricingFrequency {
  const record =
    metadata != null && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const raw =
    (typeof record.frequency === "string" ? record.frequency : null) ??
    (typeof record.quote === "object" &&
    record.quote !== null &&
    !Array.isArray(record.quote) &&
    typeof (record.quote as Record<string, unknown>).frequency === "string"
      ? ((record.quote as Record<string, unknown>).frequency as string)
      : null);
  if (raw && (PRICING_FREQUENCIES as readonly string[]).includes(raw)) {
    return raw as PricingFrequency;
  }
  return "once";
}

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
