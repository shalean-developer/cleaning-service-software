import { describe, expect, it } from "vitest";
import { buildAssignmentPathMetrics24h } from "./assignmentAnalyticsPathDto";
import {
  computePathAcceptRatePercent,
  emptyAssignmentMetricsPathCounters,
  PATH_ACCEPT_RATE_MIN_TERMINAL,
} from "./assignmentAnalyticsPathMetrics";

describe("assignmentAnalyticsPathDto (7B-1b-min)", () => {
  it("hides accept rate when terminal volume is below threshold", () => {
    const counters = {
      ...emptyAssignmentMetricsPathCounters(),
      offers_created_selected_count: 5,
      offers_accepted_selected_count: 3,
    };
    const pathTerminals = {
      selected: PATH_ACCEPT_RATE_MIN_TERMINAL - 1,
      best_available: 0,
      admin_manual: 0,
      unknown: 0,
    };
    const snapshot = buildAssignmentPathMetrics24h(counters, pathTerminals);
    expect(snapshot.selected.acceptRatePercent).toBeNull();
    expect(snapshot.selected.acceptRateLabel).toBe("Not enough data");
  });

  it("shows accept rate when terminal volume meets threshold", () => {
    expect(computePathAcceptRatePercent(5, PATH_ACCEPT_RATE_MIN_TERMINAL)).toBe(50);
    expect(computePathAcceptRatePercent(3, 5)).toBeNull();
  });
});
