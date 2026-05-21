import "server-only";

import type { BookingSeriesRow } from "@/lib/database/types";
import type { RecurringHealthAlert, RecurringHealthAlertCode, RecurringHealthSeverity } from "./recurringHealthTypes";

const VALID_FREQUENCIES = new Set(["weekly", "biweekly", "monthly"]);
const VALID_STATUSES = new Set(["active", "paused", "cancelled"]);

const CLEANER_VISIBLE_STATUSES = new Set([
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

const STALE_NEXT_MS = 24 * 60 * 60 * 1000;
const OVERDUE_PAYMENT_MS = 48 * 60 * 60 * 1000;

type BookingSlice = {
  id: string;
  customer_id: string;
  series_id: string | null;
  status: string;
  scheduled_start: string;
  price_cents?: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type PaymentSlice = {
  booking_id: string;
  status: string;
};

export function buildRecurringIntegrityAlerts(input: {
  seriesRows: BookingSeriesRow[];
  bookings: BookingSlice[];
  paidBookingIds: Set<string>;
  nowMs?: number;
}): RecurringHealthAlert[] {
  const nowMs = input.nowMs ?? Date.now();
  const alerts: RecurringHealthAlert[] = [];
  const seriesById = new Map(input.seriesRows.map((s) => [s.id, s]));
  const seriesIds = new Set(input.seriesRows.map((s) => s.id));

  for (const s of input.seriesRows) {
    if (!s.customer_id) {
      pushAlert(alerts, "CHILD_MISSING_CUSTOMER", "critical", `Series ${s.id} missing customer_id`, {
        seriesId: s.id,
      });
    }
    if (!s.created_from_booking_id) {
      pushAlert(alerts, "SERIES_MISSING_ANCHOR_ID", "warning", `Series ${s.id} missing created_from_booking_id`, {
        seriesId: s.id,
      });
    }
    if (!VALID_FREQUENCIES.has(s.frequency)) {
      pushAlert(alerts, "INVALID_SERIES_FREQUENCY", "critical", `Series ${s.id} invalid frequency`, {
        seriesId: s.id,
      });
    }
    if (!VALID_STATUSES.has(s.status)) {
      pushAlert(alerts, "INVALID_SERIES_STATUS", "critical", `Series ${s.id} invalid status`, {
        seriesId: s.id,
      });
    }
    if (
      s.status === "active" &&
      s.next_occurrence_at &&
      new Date(s.next_occurrence_at).getTime() < nowMs - STALE_NEXT_MS
    ) {
      pushAlert(
        alerts,
        "STALE_NEXT_OCCURRENCE",
        "warning",
        `Series ${s.id} next_occurrence_at stale (${s.next_occurrence_at})`,
        { seriesId: s.id },
      );
    }
  }

  const slotKeys = new Map<string, number>();
  for (const b of input.bookings) {
    if (!b.series_id) continue;
    const key = `${b.series_id}|${b.scheduled_start}`;
    slotKeys.set(key, (slotKeys.get(key) ?? 0) + 1);
  }
  for (const [key, count] of slotKeys) {
    if (count > 1) {
      const [seriesId] = key.split("|");
      pushAlert(
        alerts,
        "DUPLICATE_OCCURRENCE",
        "critical",
        `Duplicate occurrence slot ${key} (${count})`,
        { seriesId },
      );
    }
  }

  for (const b of input.bookings) {
    if (b.series_id && !seriesIds.has(b.series_id)) {
      pushAlert(alerts, "ORPHAN_CHILD", "critical", `Booking ${b.id} orphan series_id`, {
        bookingId: b.id,
        seriesId: b.series_id,
      });
    }

    const meta = b.metadata ?? {};
    const recurring = meta.recurring as Record<string, unknown> | undefined;
    const isGenerated = recurring?.generated === true;

    if (isGenerated && (!b.price_cents || b.price_cents <= 0)) {
      pushAlert(alerts, "CHILD_MISSING_PRICE", "critical", `Generated child ${b.id} missing price_cents`, {
        bookingId: b.id,
        seriesId: b.series_id ?? undefined,
      });
    }
    if (isGenerated && !b.customer_id) {
      pushAlert(alerts, "CHILD_MISSING_CUSTOMER", "critical", `Generated child ${b.id} missing customer_id`, {
        bookingId: b.id,
        seriesId: b.series_id ?? undefined,
      });
    }

    if (
      b.series_id &&
      isGenerated &&
      CLEANER_VISIBLE_STATUSES.has(b.status) &&
      !input.paidBookingIds.has(b.id)
    ) {
      pushAlert(
        alerts,
        "UNPAID_CHILD_CLEANER_VISIBLE",
        "critical",
        `Unpaid generated child ${b.id} visible to cleaners (status=${b.status})`,
        { bookingId: b.id, seriesId: b.series_id },
      );
    }

    if (!b.series_id) continue;
    const series = seriesById.get(b.series_id);
    if (!series) continue;

    if (series.status === "cancelled" && b.status === "pending_payment") {
      pushAlert(
        alerts,
        "CANCELLED_SERIES_UNPAID_CHILD",
        "warning",
        `Cancelled series ${series.id} has unpaid child ${b.id}`,
        { seriesId: series.id, bookingId: b.id },
      );
    }

    if (series.status === "paused" && isGenerated) {
      const createdMs = new Date(b.created_at).getTime();
      if (createdMs > new Date(series.updated_at).getTime() - 60_000) {
        pushAlert(
          alerts,
          "PAUSED_SERIES_NEW_CHILD",
          "critical",
          `Paused series ${series.id} has newly generated child ${b.id}`,
          { seriesId: series.id, bookingId: b.id },
        );
      }
    }

    if (b.status === "pending_payment" && isGenerated) {
      const ageMs = nowMs - new Date(b.created_at).getTime();
      if (ageMs > OVERDUE_PAYMENT_MS) {
        pushAlert(
          alerts,
          "OVERDUE_PAYMENT_REQUIRED",
          "warning",
          `Payment-required child ${b.id} older than 48h`,
          { bookingId: b.id, seriesId: b.series_id },
        );
      }
    }
  }

  return alerts;
}

function pushAlert(
  alerts: RecurringHealthAlert[],
  code: RecurringHealthAlertCode,
  severity: RecurringHealthSeverity,
  message: string,
  ids: { seriesId?: string; bookingId?: string },
): void {
  alerts.push({ code, severity, message, ...ids });
}

export function deriveOverallRecurringHealth(
  alerts: RecurringHealthAlert[],
): RecurringHealthSeverity {
  if (alerts.some((a) => a.severity === "critical")) return "critical";
  if (alerts.some((a) => a.severity === "warning")) return "warning";
  return "healthy";
}

export const RECURRING_HEALTH_CONSTANTS = {
  STALE_NEXT_MS,
  OVERDUE_PAYMENT_MS,
  HORIZON_DAYS: 45,
  MAX_SERIES_ROWS: 200,
  MAX_BOOKING_ROWS: 500,
  MAX_AUDIT_ROWS: 50,
  MAX_RUN_ROWS: 10,
} as const;
