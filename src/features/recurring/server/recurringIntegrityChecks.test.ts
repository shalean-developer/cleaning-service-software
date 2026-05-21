import { describe, expect, it } from "vitest";
import type { BookingSeriesRow } from "@/lib/database/types";
import {
  buildRecurringIntegrityAlerts,
  deriveOverallRecurringHealth,
  RECURRING_HEALTH_CONSTANTS,
} from "./recurringIntegrityChecks";

const baseSeries: BookingSeriesRow = {
  id: "series-1",
  customer_id: "cust-1",
  user_id: null,
  created_from_booking_id: "anchor-1",
  frequency: "weekly",
  timezone: "Africa/Johannesburg",
  anchor_scheduled_start: "2026-06-01T08:00:00+02:00",
  next_occurrence_at: "2026-05-01T08:00:00+02:00",
  status: "active",
  template_metadata: {},
  service_slug: "regular-cleaning",
  price_cents: 10000,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("buildRecurringIntegrityAlerts", () => {
  it("flags stale next_occurrence beyond 24h", () => {
    const nowMs = new Date("2026-06-10T12:00:00Z").getTime();
    const alerts = buildRecurringIntegrityAlerts({
      seriesRows: [baseSeries],
      bookings: [],
      paidBookingIds: new Set(),
      nowMs,
    });
    expect(alerts.some((a) => a.code === "STALE_NEXT_OCCURRENCE")).toBe(true);
  });

  it("flags unpaid generated child visible to cleaners", () => {
    const alerts = buildRecurringIntegrityAlerts({
      seriesRows: [baseSeries],
      bookings: [
        {
          id: "child-1",
          customer_id: "cust-1",
          series_id: "series-1",
          status: "assigned",
          scheduled_start: "2026-06-15T08:00:00+02:00",
          price_cents: 10000,
          metadata: { recurring: { generated: true } },
          created_at: "2026-06-01T00:00:00Z",
        },
      ],
      paidBookingIds: new Set(),
      nowMs: Date.now(),
    });
    expect(alerts.some((a) => a.code === "UNPAID_CHILD_CLEANER_VISIBLE")).toBe(true);
    expect(deriveOverallRecurringHealth(alerts)).toBe("critical");
  });

  it("reports healthy when no issues", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const alerts = buildRecurringIntegrityAlerts({
      seriesRows: [{ ...baseSeries, next_occurrence_at: future }],
      bookings: [],
      paidBookingIds: new Set(),
    });
    expect(deriveOverallRecurringHealth(alerts)).toBe("healthy");
  });
});

describe("RECURRING_HEALTH_CONSTANTS", () => {
  it("uses 24h stale and 48h overdue thresholds", () => {
    expect(RECURRING_HEALTH_CONSTANTS.STALE_NEXT_MS).toBe(24 * 60 * 60 * 1000);
    expect(RECURRING_HEALTH_CONSTANTS.OVERDUE_PAYMENT_MS).toBe(48 * 60 * 60 * 1000);
  });
});
