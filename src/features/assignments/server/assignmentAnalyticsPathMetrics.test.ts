import { describe, expect, it } from "vitest";
import {
  aggregateAssignmentMetricsPathHourly,
  sumPathAcceptedCounts,
  sumPathCreatedCounts,
} from "./assignmentAnalyticsPathMetrics";
import { aggregateAssignmentMetricsHourly as aggregateGlobal } from "./assignmentMetricsAggregate";
import type { AssignmentAnalyticsPath } from "./resolveAssignmentAnalyticsPath";

const bucketStart = new Date("2026-05-18T10:00:00.000Z");
const bucketEnd = new Date("2026-05-18T11:00:00.000Z");

describe("assignmentAnalyticsPathMetrics (7B-1b-min)", () => {
  it("path created and accepted sums match global counters", () => {
    const offersCreated = [
      {
        booking_id: "b-selected",
        status: "offered" as const,
        offered_at: "2026-05-18T10:10:00.000Z",
        responded_at: null,
        updated_at: "2026-05-18T10:10:00.000Z",
      },
      {
        booking_id: "b-best",
        status: "offered" as const,
        offered_at: "2026-05-18T10:20:00.000Z",
        responded_at: null,
        updated_at: "2026-05-18T10:20:00.000Z",
      },
    ];
    const terminal = [
      {
        booking_id: "b-selected",
        status: "accepted" as const,
        offered_at: "2026-05-18T10:10:00.000Z",
        responded_at: "2026-05-18T10:30:00.000Z",
        updated_at: "2026-05-18T10:30:00.000Z",
      },
    ];
    const pathByBookingId = new Map<string, AssignmentAnalyticsPath>([
      ["b-selected", "selected"],
      ["b-best", "best_available"],
    ]);

    const global = aggregateGlobal(
      bucketStart,
      bucketEnd,
      offersCreated,
      offersCreated,
      terminal,
      [],
      0,
    );
    const path = aggregateAssignmentMetricsPathHourly(
      bucketStart,
      bucketEnd,
      offersCreated,
      terminal,
      pathByBookingId,
    );

    expect(sumPathCreatedCounts(path)).toBe(global.offers_created_count);
    expect(sumPathAcceptedCounts(path)).toBe(global.offers_accepted_count);
    expect(path.offers_created_selected_count).toBe(1);
    expect(path.offers_created_best_available_count).toBe(1);
    expect(path.offers_accepted_selected_count).toBe(1);
    expect(path.offers_accepted_best_available_count).toBe(0);
  });
});
