import type { BookingRow } from "@/lib/database/types";
import { isServiceSlug } from "@/features/pricing/server/catalog";
import { resolveRequestedTeamSize } from "@/features/pricing/server/resolveRequestedTeamSize";

/** Reads customer-requested team size from booking metadata quote snapshot. */
export function requestedTeamSizeFromBooking(booking: BookingRow): 1 | 2 {
  const metadata =
    booking.metadata != null &&
    typeof booking.metadata === "object" &&
    !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : {};

  const serviceSlugRaw =
    typeof metadata.serviceSlug === "string" ? metadata.serviceSlug : "regular-cleaning";
  const serviceSlug = isServiceSlug(serviceSlugRaw) ? serviceSlugRaw : "regular-cleaning";

  const quote = metadata.quote;
  if (quote != null && typeof quote === "object" && !Array.isArray(quote)) {
    const input = (quote as Record<string, unknown>).input;
    if (input != null && typeof input === "object" && !Array.isArray(input)) {
      const requested = (input as Record<string, unknown>).requestedTeamSize;
      return resolveRequestedTeamSize(
        serviceSlug,
        typeof requested === "number" ? requested : undefined,
      );
    }
  }

  return 1;
}
