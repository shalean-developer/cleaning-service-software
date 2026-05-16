import "server-only";

import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingRow } from "@/lib/database/types";
import { computeEarningsForBooking } from "./computeEarningsForBooking";
import type { RecordEarningsResult } from "./types";

const COMPLETION_LINE_TYPE = "booking_completion";

/**
 * Idempotently creates earning_lines for a completed booking.
 */
export async function recordEarningsForBooking(
  backend: BookingCommandBackend,
  booking: BookingRow,
): Promise<RecordEarningsResult> {
  const existing = await backend.listEarningLinesForBooking(booking.id);
  const completionLines = existing.filter((l) => l.line_type === COMPLETION_LINE_TYPE);
  if (completionLines.length > 0) {
    return {
      ok: true,
      created: false,
      lineIds: completionLines.map((l) => l.id),
    };
  }

  const computed = computeEarningsForBooking(booking);
  if ("ok" in computed) {
    return { ok: false, code: computed.code, message: computed.message };
  }

  try {
    await backend.appendEarningLine({
      cleaner_id: computed.cleanerId,
      booking_id: booking.id,
      amount_cents: computed.payoutAmountCents,
      gross_amount_cents: computed.grossAmountCents,
      payout_amount_cents: computed.payoutAmountCents,
      payout_status: "pending",
      payout_batch_id: null,
      line_type: COMPLETION_LINE_TYPE,
      description: "Booking completion earnings",
      metadata: { source: "recordEarningsForBooking" },
      calculation_metadata: computed.calculationMetadata as import("@/lib/database/types").Json,
    });
    const after = await backend.listEarningLinesForBooking(booking.id);
    const lines = after.filter((l) => l.line_type === COMPLETION_LINE_TYPE);
    return {
      ok: true,
      created: true,
      lineIds: lines.map((l) => l.id),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not persist earnings.";
    if (message.includes("duplicate") || message.includes("unique")) {
      const after = await backend.listEarningLinesForBooking(booking.id);
      const lines = after.filter((l) => l.line_type === COMPLETION_LINE_TYPE);
      return {
        ok: true,
        created: false,
        lineIds: lines.map((l) => l.id),
      };
    }
    return { ok: false, code: "PERSISTENCE_ERROR", message };
  }
}
