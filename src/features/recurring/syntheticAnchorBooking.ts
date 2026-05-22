import type { BookingRow } from "@/lib/database/types";

/** Cadence-only booking rows. never customer visits or cleaner jobs. */
export function isSyntheticAnchorBooking(
  booking: Pick<BookingRow, "synthetic_anchor" | "metadata">,
): boolean {
  if (booking.synthetic_anchor === true) return true;
  const meta =
    booking.metadata != null && typeof booking.metadata === "object" && !Array.isArray(booking.metadata)
      ? (booking.metadata as Record<string, unknown>)
      : {};
  const recurring = meta.recurring;
  if (recurring != null && typeof recurring === "object" && !Array.isArray(recurring)) {
    return (recurring as Record<string, unknown>).syntheticAnchor === true;
  }
  return false;
}
