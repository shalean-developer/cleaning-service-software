/**
 * Shared recurring integrity checks for ops audit and soak scripts.
 */

export const STALE_NEXT_MS = 24 * 60 * 60 * 1000;
export const OVERDUE_PAYMENT_MS = 48 * 60 * 60 * 1000;

const CLEANER_VISIBLE = new Set([
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

/**
 * @param {object} input
 * @param {Array} input.seriesRows
 * @param {Array} input.bookings
 * @param {Set<string>} input.paidBookingIds
 * @param {number} [input.nowMs]
 * @returns {Array<{ code: string, severity: string, detail: string, seriesId?: string, bookingId?: string }>}
 */
export function buildRecurringIntegrityIssues(input) {
  const nowMs = input.nowMs ?? Date.now();
  const issues = [];
  const seriesById = new Map((input.seriesRows ?? []).map((s) => [s.id, s]));
  const seriesIds = new Set((input.seriesRows ?? []).map((s) => s.id));

  function report(code, severity, detail, ids = {}) {
    issues.push({ code, severity, detail, ...ids });
  }

  for (const s of input.seriesRows ?? []) {
    if (s.status === "active" && !s.next_occurrence_at) {
      report("ACTIVE_SERIES_NO_NEXT", "warning", `series ${s.id} active with null next_occurrence_at`, {
        seriesId: s.id,
      });
    }
    if (
      s.status === "active" &&
      s.next_occurrence_at &&
      new Date(s.next_occurrence_at).getTime() < nowMs - STALE_NEXT_MS
    ) {
      report(
        "STALE_NEXT_OCCURRENCE",
        "warning",
        `series ${s.id} next_occurrence_at stale (${s.next_occurrence_at})`,
        { seriesId: s.id },
      );
    }
    if (!s.customer_id) {
      report("SERIES_MISSING_CUSTOMER", "critical", `series ${s.id} missing customer_id`, {
        seriesId: s.id,
      });
    }
    if (!s.created_from_booking_id) {
      report("SERIES_MISSING_ANCHOR_ID", "warning", `series ${s.id} missing created_from_booking_id`, {
        seriesId: s.id,
      });
    }
    if (!["weekly", "biweekly", "monthly"].includes(s.frequency)) {
      report("SERIES_INVALID_FREQUENCY", "critical", `series ${s.id} frequency=${s.frequency}`, {
        seriesId: s.id,
      });
    }
    if (!["active", "paused", "cancelled"].includes(s.status)) {
      report("SERIES_INVALID_STATUS", "critical", `series ${s.id} status=${s.status}`, {
        seriesId: s.id,
      });
    }
  }

  for (const b of input.bookings ?? []) {
    if (b.series_id && !seriesIds.has(b.series_id)) {
      report("ORPHAN_SERIES_ID", "critical", `booking ${b.id} references missing series ${b.series_id}`, {
        bookingId: b.id,
        seriesId: b.series_id,
      });
    }
  }

  const slotKeys = new Map();
  for (const b of input.bookings ?? []) {
    if (!b.series_id) continue;
    const key = `${b.series_id}|${b.scheduled_start}`;
    slotKeys.set(key, (slotKeys.get(key) ?? 0) + 1);
  }
  for (const [key, count] of slotKeys) {
    if (count > 1) {
      const [seriesId] = key.split("|");
      report("DUPLICATE_OCCURRENCE", "critical", `${key} count=${count}`, { seriesId });
    }
  }

  for (const b of input.bookings ?? []) {
    const meta = b.metadata ?? {};
    const recurring = meta.recurring;
    const isGenerated = recurring?.generated === true;

    if (isGenerated && (!b.price_cents || b.price_cents <= 0)) {
      report("CHILD_MISSING_PRICE", "critical", `booking ${b.id} missing price_cents`, {
        bookingId: b.id,
        seriesId: b.series_id,
      });
    }
    if (isGenerated && !b.customer_id) {
      report("CHILD_MISSING_CUSTOMER", "critical", `booking ${b.id} missing customer_id`, {
        bookingId: b.id,
        seriesId: b.series_id,
      });
    }

    if (
      b.series_id &&
      isGenerated &&
      CLEANER_VISIBLE.has(b.status) &&
      !input.paidBookingIds.has(b.id)
    ) {
      report(
        "UNPAID_CHILD_CLEANER_VISIBLE",
        "critical",
        `booking ${b.id} series child status=${b.status} without paid payment`,
        { bookingId: b.id, seriesId: b.series_id },
      );
    }

    if (!b.series_id) continue;
    const series = seriesById.get(b.series_id);
    if (!series) continue;

    if (series.status === "paused" && b.status === "pending_payment") {
      report(
        "PAUSED_SERIES_UNPAID_CHILD",
        "warning",
        `series ${series.id} paused but booking ${b.id} still pending_payment`,
        { seriesId: series.id, bookingId: b.id },
      );
    }
    if (series.status === "cancelled" && b.status === "pending_payment") {
      report(
        "CANCELLED_SERIES_UNPAID_CHILD",
        "warning",
        `series ${series.id} cancelled but booking ${b.id} still pending_payment`,
        { seriesId: series.id, bookingId: b.id },
      );
    }

    if (series.status === "paused" && isGenerated) {
      const createdMs = new Date(b.created_at).getTime();
      if (createdMs > new Date(series.updated_at).getTime() - 60_000) {
        report(
          "PAUSED_SERIES_NEW_CHILD",
          "critical",
          `paused series ${series.id} has new generated child ${b.id}`,
          { seriesId: series.id, bookingId: b.id },
        );
      }
    }

    if (b.status === "pending_payment" && isGenerated) {
      const ageMs = nowMs - new Date(b.created_at).getTime();
      if (ageMs > OVERDUE_PAYMENT_MS) {
        report(
          "OVERDUE_PAYMENT_REQUIRED",
          "warning",
          `booking ${b.id} pending_payment older than 48h`,
          { bookingId: b.id, seriesId: b.series_id },
        );
      }
    }
  }

  return issues;
}

/**
 * @param {Array<{ severity: string }>} issues
 * @returns {"PASS"|"WARN"|"FAIL"}
 */
export function deriveSoakStatus(issues) {
  if (issues.some((i) => i.severity === "critical")) return "FAIL";
  if (issues.length > 0) return "WARN";
  return "PASS";
}
