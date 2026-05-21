import { describe, expect, it } from "vitest";
import { buildRecurringIntegrityIssues } from "./recurring-integrity.mjs";

describe("recurring group integrity", () => {
  it("detects selected_days without matching series weekday", () => {
    const issues = buildRecurringIntegrityIssues({
      seriesRows: [
        {
          id: "s1",
          group_id: "g1",
          weekday: 1,
          customer_id: "c1",
          status: "active",
          frequency: "weekly",
        },
      ],
      bookings: [],
      paidBookingIds: new Set(),
      groupRows: [
        {
          id: "g1",
          customer_id: "c1",
          status: "active",
          frequency: "weekly",
          selected_days: [1, 3, 5],
        },
      ],
    });
    expect(issues.some((i) => i.code === "GROUP_SELECTED_DAYS_MISMATCH")).toBe(true);
  });

  it("detects synthetic anchor with cleaner assignment", () => {
    const issues = buildRecurringIntegrityIssues({
      seriesRows: [{ id: "s1", group_id: "g1", weekday: 1, status: "active", frequency: "weekly" }],
      bookings: [
        {
          id: "b1",
          series_id: "s1",
          status: "assigned",
          synthetic_anchor: true,
          cleaner_id: "cleaner-1",
          metadata: {},
          created_at: new Date().toISOString(),
        },
      ],
      paidBookingIds: new Set(),
      groupRows: [{ id: "g1", status: "active", frequency: "weekly", selected_days: [1] }],
    });
    expect(issues.some((i) => i.code === "SYNTHETIC_ANCHOR_CLEANER_ASSIGNED")).toBe(true);
  });
});
