import "server-only";

import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import { isTeamEarningsEnabled } from "./teamEarningsConfig";
import {
  hasPayoutReadyBlockingIssues,
  reconcileTeamEarningsForBooking,
} from "./teamEarningsReconciliation";
import { trueUpTeamEarningsForBooking } from "./teamEarningsTrueUp";

function formatBlockingMessage(
  issues: { code: string; message: string }[],
): string {
  if (issues.length === 0) {
    return "Team earnings reconciliation blocked payout-ready.";
  }
  const summary = issues
    .slice(0, 3)
    .map((i) => i.message)
    .join(" ");
  return issues.length > 3 ? `${summary} (+${issues.length - 3} more)` : summary;
}

export async function markBookingEarningsPayoutReady(
  backend: BookingCommandBackend,
  bookingId: string,
): Promise<{ ok: true; updated: number } | { ok: false; code: string; message: string }> {
  const booking = await backend.getBooking(bookingId);
  if (!booking) {
    return { ok: false, code: "BOOKING_NOT_FOUND", message: "Booking not found." };
  }

  if (isTeamEarningsEnabled()) {
    const trueUp = await trueUpTeamEarningsForBooking(backend, booking);
    if (!trueUp.ok) {
      return { ok: false, code: trueUp.code, message: trueUp.message };
    }

    const roster = await backend.listBookingCleanersForBooking(bookingId);
    const earningLines = await backend.listEarningLinesForBooking(bookingId);
    const reconciliation = reconcileTeamEarningsForBooking({
      booking,
      roster,
      earningLines,
    });

    if (hasPayoutReadyBlockingIssues(reconciliation)) {
      return {
        ok: false,
        code: "EARNINGS_RECONCILIATION_BLOCKED",
        message: formatBlockingMessage(reconciliation.blockingIssues),
      };
    }
  }

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
