import "server-only";

import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";

export async function markBookingEarningsPaid(
  backend: BookingCommandBackend,
  bookingId: string,
  payoutBatchId?: string | null,
): Promise<{ ok: true; updated: number } | { ok: false; code: string; message: string }> {
  const lines = await backend.listEarningLinesForBooking(bookingId);
  const ready = lines.filter((l) => l.payout_status === "payout_ready");
  if (ready.length === 0) {
    return {
      ok: false,
      code: "EARNINGS_NOT_FOUND",
      message: "No payout-ready earnings found for this booking.",
    };
  }

  const updated = await backend.updateEarningLinesPayoutStatus(
    bookingId,
    "payout_ready",
    "paid",
    payoutBatchId ?? null,
  );
  if (updated === 0) {
    return {
      ok: false,
      code: "EARNINGS_NOT_FOUND",
      message: "Could not mark earnings paid.",
    };
  }

  return { ok: true, updated };
}
