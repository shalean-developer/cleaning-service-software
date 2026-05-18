import "server-only";

import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingRow } from "@/lib/database/types";
import { computeEarningsForBooking } from "./computeEarningsForBooking";
import { isTeamEarningsEnabled } from "./teamEarningsConfig";
import { resolveTeamEarningsPool } from "./teamEarningsPool";
import { trueUpTeamEarningsForBooking } from "./teamEarningsTrueUp";
import {
  PRIMARY_COMPLETION_LINE_TYPE,
  computePrimaryCompletionSplit,
} from "./teamEarningsSplit";
import type { RecordEarningsResult } from "./types";

/**
 * Idempotently creates earning_lines for a completed booking.
 * NF-7G: When TEAM_EARNINGS_ENABLED, primary line uses equal-split reservation when support is on roster.
 */
export async function recordEarningsForBooking(
  backend: BookingCommandBackend,
  booking: BookingRow,
): Promise<RecordEarningsResult> {
  const existing = await backend.listEarningLinesForBooking(booking.id);
  const completionLines = existing.filter((l) => l.line_type === PRIMARY_COMPLETION_LINE_TYPE);
  if (completionLines.length > 0) {
    if (isTeamEarningsEnabled()) {
      const trueUp = await trueUpTeamEarningsForBooking(backend, booking);
      if (!trueUp.ok) {
        return { ok: false, code: trueUp.code, message: trueUp.message };
      }
    }
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

  const teamEarningsOn = isTeamEarningsEnabled();
  const roster = teamEarningsOn
    ? await backend.listBookingCleanersForBooking(booking.id)
    : [];

  const pool = resolveTeamEarningsPool(booking);
  if (!pool.ok) {
    return { ok: false, code: pool.code, message: pool.message };
  }

  const split = computePrimaryCompletionSplit(
    pool.totalPoolCents,
    roster,
    teamEarningsOn,
  );

  const payoutAmountCents = teamEarningsOn
    ? split.payoutAmountCents
    : computed.payoutAmountCents;

  if (payoutAmountCents <= 0) {
    return {
      ok: false,
      code: "EARNINGS_INVALID",
      message: "Computed payout must be greater than zero.",
    };
  }

  try {
    await backend.appendEarningLine({
      cleaner_id: computed.cleanerId,
      booking_id: booking.id,
      amount_cents: payoutAmountCents,
      gross_amount_cents: pool.grossAmountCents,
      payout_amount_cents: payoutAmountCents,
      payout_status: "pending",
      payout_batch_id: null,
      line_type: PRIMARY_COMPLETION_LINE_TYPE,
      description: "Booking completion earnings",
      metadata: {
        source: "recordEarningsForBooking",
        teamRole: split.teamEarningRole,
        earningSource: split.teamEarningSource,
      },
      calculation_metadata: {
        ...computed.calculationMetadata,
        ...pool.calculationMetadata,
        splitPolicy: split.splitPolicy,
        participantCount: split.participantCount,
        totalPoolCents: split.totalPoolCents,
        teamEarningRole: split.teamEarningRole,
        teamEarningSource: split.teamEarningSource,
      } as import("@/lib/database/types").Json,
      team_earning_role: teamEarningsOn ? split.teamEarningRole : null,
      team_earning_source: teamEarningsOn ? split.teamEarningSource : null,
    });
    if (teamEarningsOn) {
      const trueUp = await trueUpTeamEarningsForBooking(backend, booking);
      if (!trueUp.ok) {
        return { ok: false, code: trueUp.code, message: trueUp.message };
      }
    }

    const after = await backend.listEarningLinesForBooking(booking.id);
    const lines = after.filter((l) => l.line_type === PRIMARY_COMPLETION_LINE_TYPE);
    return {
      ok: true,
      created: true,
      lineIds: lines.map((l) => l.id),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not persist earnings.";
    if (message.includes("duplicate") || message.includes("unique")) {
      const after = await backend.listEarningLinesForBooking(booking.id);
      const lines = after.filter((l) => l.line_type === PRIMARY_COMPLETION_LINE_TYPE);
      return {
        ok: true,
        created: false,
        lineIds: lines.map((l) => l.id),
      };
    }
    return { ok: false, code: "PERSISTENCE_ERROR", message };
  }
}
