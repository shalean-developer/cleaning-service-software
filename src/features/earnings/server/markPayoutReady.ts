import "server-only";

import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";

export async function markBookingEarningsPayoutReady(
  backend: BookingCommandBackend,
  bookingId: string,
): Promise<{ ok: true; updated: number } | { ok: false; code: string; message: string }> {
  const lines = await backend.listEarningLinesForBooking(bookingId);
  const pending = lines.filter((l) => l.payout_status === "pending");
  if (pending.length === 0) {
    return {
      ok: false,
      code: "EARNINGS_NOT_FOUND",
      message: "No pending earnings found for this booking.",
    };
  }

  const updated = await backend.updateEarningLinesPayoutStatus(bookingId, "pending", "payout_ready");
  if (updated === 0) {
    return {
      ok: false,
      code: "EARNINGS_NOT_FOUND",
      message: "Could not mark earnings payout-ready.",
    };
  }

  return { ok: true, updated };
}
