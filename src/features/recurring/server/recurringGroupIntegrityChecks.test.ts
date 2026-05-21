import { describe, expect, it } from "vitest";
import type { BookingSeriesRow, RecurringScheduleGroupRow } from "@/lib/database/types";
import { buildRecurringGroupIntegrityAlerts } from "./recurringGroupIntegrityChecks";

function series(overrides: Partial<BookingSeriesRow> = {}): BookingSeriesRow {
  return {
    id: "series-1",
    customer_id: "cust-1",
    user_id: null,
    group_id: "group-1",
    weekday: 1,
    slot_label: null,
    created_from_booking_id: "anchor-1",
    frequency: "weekly",
    timezone: "Africa/Johannesburg",
    anchor_scheduled_start: "2026-05-01T08:00:00.000Z",
    next_occurrence_at: "2026-06-01T08:00:00.000Z",
    status: "active",
    template_metadata: {},
    service_slug: "standard-clean",
    price_cents: 50_000,
    created_at: "2026-05-01T08:00:00.000Z",
    updated_at: "2026-05-01T08:00:00.000Z",
    ...overrides,
  };
}

function scheduleGroup(
  overrides: Partial<RecurringScheduleGroupRow> = {},
): RecurringScheduleGroupRow {
  return {
    id: "group-1",
    customer_id: "cust-1",
    service_slug: "standard-clean",
    status: "active",
    frequency: "weekly",
    timezone: "Africa/Johannesburg",
    label: null,
    selected_days: [1, 3],
    anchor_booking_id: "anchor-1",
    created_at: "2026-05-01T08:00:00.000Z",
    updated_at: "2026-05-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("buildRecurringGroupIntegrityAlerts", () => {
  it("flags cancelled group with active series", () => {
    const alerts = buildRecurringGroupIntegrityAlerts({
      groups: [scheduleGroup({ status: "cancelled" })],
      seriesRows: [series({ status: "active" })],
    });
    expect(alerts.some((a) => a.code === "GROUP_CANCELLED_WITH_ACTIVE_SERIES")).toBe(true);
  });

  it("flags paused group with active series", () => {
    const alerts = buildRecurringGroupIntegrityAlerts({
      groups: [scheduleGroup({ status: "paused" })],
      seriesRows: [series({ status: "active" })],
    });
    expect(alerts.some((a) => a.code === "GROUP_PAUSED_WITH_ACTIVE_SERIES")).toBe(true);
  });

  it("flags group with no linked series", () => {
    const alerts = buildRecurringGroupIntegrityAlerts({
      groups: [scheduleGroup()],
      seriesRows: [],
    });
    expect(alerts.some((a) => a.code === "GROUP_NO_ACTIVE_SERIES")).toBe(true);
  });
});
