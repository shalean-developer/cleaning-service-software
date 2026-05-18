import { describe, expect, it } from "vitest";
import {
  buildAssignmentLatencyMetricDto,
  formatApproximateLatencyMetricDisplay,
  formatLatencyMetricDisplay,
  formatLatencyMinutes,
} from "./assignmentLatencyDto";
import { ASSIGNMENT_LATENCY_MIN_SAMPLE } from "./assignmentLatencyMetrics";

describe("assignmentLatencyDto (7B-1c-min)", () => {
  it("gates medians when sample is below minimum", () => {
    const metric = buildAssignmentLatencyMetricDto(
      Array.from({ length: ASSIGNMENT_LATENCY_MIN_SAMPLE - 1 }, () => 15),
    );

    expect(metric.status).toBe("insufficient_data");
    expect(metric.medianMinutes).toBeNull();
    expect(metric.sampleSize).toBe(ASSIGNMENT_LATENCY_MIN_SAMPLE - 1);
    expect(formatLatencyMetricDisplay(metric)).toBe("Insufficient data");
  });

  it("returns median when sample meets minimum", () => {
    const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const metric = buildAssignmentLatencyMetricDto(durations);

    expect(metric.status).toBe("ok");
    expect(metric.medianMinutes).toBe(55);
    expect(metric.sampleSize).toBe(10);
    expect(formatLatencyMetricDisplay(metric)).toBe("55 min");
  });

  it("formats hours for longer medians", () => {
    expect(formatLatencyMinutes(204)).toBe("3.4 h");
  });

  it("prefixes approximate rollup medians with tilde", () => {
    expect(formatApproximateLatencyMetricDisplay(150, "ok")).toBe("~2.5 h");
    expect(formatApproximateLatencyMetricDisplay(null, "insufficient_data")).toBe(
      "Insufficient data",
    );
  });
});
