import "server-only";

import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingRow } from "@/lib/database/types";
import { isTeamEarningsEnabled } from "./teamEarningsConfig";
import { resolveTeamEarningsPool } from "./teamEarningsPool";
import { recordSupportTeamEarningsForBooking } from "./recordSupportTeamEarnings";
import {
  PRIMARY_COMPLETION_LINE_TYPE,
  computeEqualShareCents,
  equalSplitParticipantCount,
  rosterAcceptedSupportRows,
  rosterConfirmedSupportRows,
} from "./teamEarningsSplit";

export type TeamEarningsTrueUpResult =
  | {
      ok: true;
      skipped: boolean;
      adjustedPrimary: boolean;
      createdSupportLineIds: string[];
    }
  | { ok: false; code: string; message: string };

/**
 * NF-7H: Idempotently align team earning lines with equal-split policy.
 * - Adjusts pending primary line to expected share when support is on roster.
 * - Creates missing support lines for completed support cleaners.
 * Does not mutate payout_ready/paid lines or remove orphan rows.
 */
export async function trueUpTeamEarningsForBooking(
  backend: BookingCommandBackend,
  booking: BookingRow,
): Promise<TeamEarningsTrueUpResult> {
  if (!isTeamEarningsEnabled()) {
    return {
      ok: true,
      skipped: true,
      adjustedPrimary: false,
      createdSupportLineIds: [],
    };
  }

  const roster = await backend.listBookingCleanersForBooking(booking.id);
  if (rosterAcceptedSupportRows(roster).length === 0) {
    return {
      ok: true,
      skipped: false,
      adjustedPrimary: false,
      createdSupportLineIds: [],
    };
  }

  const pool = resolveTeamEarningsPool(booking);
  if (!pool.ok) {
    return { ok: false, code: pool.code, message: pool.message };
  }

  const participantCount = equalSplitParticipantCount(roster);
  const expectedShareCents = computeEqualShareCents(pool.totalPoolCents, participantCount);

  let adjustedPrimary = false;
  const lines = await backend.listEarningLinesForBooking(booking.id);
  const primaryLine = lines.find(
    (l) =>
      l.line_type === PRIMARY_COMPLETION_LINE_TYPE &&
      l.cleaner_id === booking.cleaner_id,
  );

  if (
    primaryLine &&
    primaryLine.payout_status === "pending" &&
    primaryLine.payout_amount_cents !== expectedShareCents &&
    expectedShareCents > 0
  ) {
    const updated = await backend.updateEarningLinePayoutAmount(
      booking.id,
      primaryLine.id,
      expectedShareCents,
      {
        team_earning_source: "team_split",
        team_earning_role: "primary",
      },
    );
    adjustedPrimary = updated;
  }

  const createdSupportLineIds: string[] = [];
  for (const support of rosterConfirmedSupportRows(roster)) {
    const result = await recordSupportTeamEarningsForBooking(
      backend,
      booking,
      support.cleaner_id,
    );
    if (!result.ok) {
      if (result.code === "INVALID_STATE" || result.code === "EARNINGS_NOT_FOUND") {
        continue;
      }
      return { ok: false, code: result.code, message: result.message };
    }
    if (result.created) {
      createdSupportLineIds.push(...result.lineIds);
    }
  }

  return {
    ok: true,
    skipped: false,
    adjustedPrimary,
    createdSupportLineIds,
  };
}
