import "server-only";

import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingRow } from "@/lib/database/types";
import { isTeamEarningsEnabled } from "./teamEarningsConfig";
import { resolveTeamEarningsPool } from "./teamEarningsPool";
import {
  PRIMARY_COMPLETION_LINE_TYPE,
  SUPPORT_COMPLETION_LINE_TYPE,
  computeSupportCompletionSplit,
} from "./teamEarningsSplit";
import type { RecordEarningsResult } from "./types";

const LEAD_COMPLETED_STATUSES = new Set(["completed", "payout_ready", "paid_out"]);

/**
 * NF-7G: Create support cleaner earning line after participation confirmation.
 * Requires lead booking completion and confirmed support roster row.
 */
export async function recordSupportTeamEarningsForBooking(
  backend: BookingCommandBackend,
  booking: BookingRow,
  supportCleanerId: string,
): Promise<RecordEarningsResult> {
  if (!isTeamEarningsEnabled()) {
    return { ok: true, created: false, lineIds: [] };
  }

  if (!LEAD_COMPLETED_STATUSES.has(booking.status)) {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: "Support earnings require the lead cleaner to have completed the booking.",
    };
  }

  const roster = await backend.listBookingCleanersForBooking(booking.id);
  const supportRow = roster.find(
    (r) => r.cleaner_id === supportCleanerId && r.role === "support",
  );
  if (!supportRow || supportRow.status !== "completed") {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: "Support earning line requires confirmed participation.",
    };
  }

  const existing = await backend.listEarningLinesForBooking(booking.id);
  const supportLines = existing.filter(
    (l) =>
      l.line_type === SUPPORT_COMPLETION_LINE_TYPE && l.cleaner_id === supportCleanerId,
  );
  if (supportLines.length > 0) {
    return {
      ok: true,
      created: false,
      lineIds: supportLines.map((l) => l.id),
    };
  }

  const primaryLine = existing.find(
    (l) =>
      l.line_type === PRIMARY_COMPLETION_LINE_TYPE &&
      l.cleaner_id === booking.cleaner_id,
  );
  if (!primaryLine) {
    return {
      ok: false,
      code: "EARNINGS_NOT_FOUND",
      message: "Primary completion earnings must exist before support earnings.",
    };
  }

  const pool = resolveTeamEarningsPool(booking);
  if (!pool.ok) {
    return { ok: false, code: pool.code, message: pool.message };
  }

  const split = computeSupportCompletionSplit(pool.totalPoolCents, roster);
  if (split.payoutAmountCents <= 0) {
    return {
      ok: false,
      code: "EARNINGS_INVALID",
      message: "Support split payout must be greater than zero.",
    };
  }

  try {
    await backend.appendEarningLine({
      cleaner_id: supportCleanerId,
      booking_id: booking.id,
      amount_cents: split.payoutAmountCents,
      gross_amount_cents: pool.grossAmountCents,
      payout_amount_cents: split.payoutAmountCents,
      payout_status: "pending",
      payout_batch_id: null,
      line_type: SUPPORT_COMPLETION_LINE_TYPE,
      description: "Team support completion earnings",
      metadata: {
        source: "recordSupportTeamEarnings",
        teamRole: "support",
        earningSource: "team_split",
      },
      calculation_metadata: {
        ...pool.calculationMetadata,
        splitPolicy: "equal",
        participantCount: split.participantCount,
        totalPoolCents: pool.totalPoolCents,
        teamEarningRole: "support",
        teamEarningSource: "team_split",
      } as import("@/lib/database/types").Json,
      team_earning_role: "support",
      team_earning_source: "team_split",
    });

    const after = await backend.listEarningLinesForBooking(booking.id);
    const lines = after.filter(
      (l) =>
        l.line_type === SUPPORT_COMPLETION_LINE_TYPE &&
        l.cleaner_id === supportCleanerId,
    );
    return {
      ok: true,
      created: true,
      lineIds: lines.map((l) => l.id),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not persist support earnings.";
    if (message.includes("duplicate") || message.includes("unique")) {
      const after = await backend.listEarningLinesForBooking(booking.id);
      const lines = after.filter(
        (l) =>
          l.line_type === SUPPORT_COMPLETION_LINE_TYPE &&
          l.cleaner_id === supportCleanerId,
      );
      return {
        ok: true,
        created: false,
        lineIds: lines.map((l) => l.id),
      };
    }
    return { ok: false, code: "PERSISTENCE_ERROR", message };
  }
}
