import { describe, expect, it } from "vitest";
import {
  buildRecurringGroupE2eReport,
  deriveGroupLaunchRecommendation,
} from "./recurring-group-e2e.mjs";

describe("buildRecurringGroupE2eReport", () => {
  it("flags unpaid cleaner-visible group children as FAIL", () => {
    const report = buildRecurringGroupE2eReport({
      groupRows: [
        {
          id: "g1",
          customer_id: "c1",
          status: "active",
          frequency: "weekly",
          selected_days: [1, 3],
        },
      ],
      seriesRows: [
        {
          id: "s1",
          customer_id: "c1",
          group_id: "g1",
          weekday: 1,
          status: "active",
          frequency: "weekly",
        },
      ],
      bookings: [
        {
          id: "b1",
          series_id: "s1",
          status: "assigned",
          synthetic_anchor: false,
          metadata: { recurring: { generated: true } },
          created_at: new Date().toISOString(),
        },
      ],
      paidBookingIds: new Set(),
      requestRows: [],
      latestRun: null,
    });
    expect(report.metrics.unpaidCleanerVisibleRisk).toBe(1);
    expect(report.status).toBe("FAIL");
    expect(deriveGroupLaunchRecommendation(report)).toBe("BLOCKED");
  });

  it("excludes synthetic anchors from real visit count", () => {
    const report = buildRecurringGroupE2eReport({
      groupRows: [{ id: "g1", selected_days: [1], status: "active", frequency: "weekly" }],
      seriesRows: [{ id: "s1", group_id: "g1", weekday: 1, status: "active", frequency: "weekly" }],
      bookings: [
        {
          id: "syn",
          series_id: "s1",
          status: "confirmed",
          synthetic_anchor: true,
          metadata: {},
          created_at: new Date().toISOString(),
        },
        {
          id: "child",
          series_id: "s1",
          status: "pending_payment",
          synthetic_anchor: false,
          metadata: { recurring: { generated: true } },
          created_at: new Date().toISOString(),
        },
      ],
      paidBookingIds: new Set(),
      requestRows: [],
      latestRun: null,
    });
    expect(report.metrics.syntheticAnchorCount).toBe(1);
    expect(report.metrics.realVisitCount).toBe(1);
    expect(report.metrics.unpaidChildCount).toBe(1);
  });
});
