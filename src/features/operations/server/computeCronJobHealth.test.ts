import { describe, expect, it } from "vitest";
import {
  computeCronHealthFromBacklog,
  computeCronJobHealthFromLastRun,
  mergeCronHealthLevels,
} from "./computeCronJobHealth";

describe("computeCronJobHealthFromLastRun", () => {
  const now = new Date("2030-06-01T12:00:00.000Z");

  it("returns unknown when no run recorded", () => {
    expect(computeCronJobHealthFromLastRun(null, 60, now).level).toBe("unknown");
  });

  it("classifies healthy within expected hourly interval", () => {
    const completedAt = new Date("2030-06-01T11:30:00.000Z").toISOString();
    expect(computeCronJobHealthFromLastRun(completedAt, 60, now).level).toBe("healthy");
  });

  it("classifies warning when run is stale but not critical", () => {
    const completedAt = new Date("2030-06-01T10:30:00.000Z").toISOString();
    expect(computeCronJobHealthFromLastRun(completedAt, 60, now).level).toBe("warning");
  });

  it("classifies critical when run is far past schedule", () => {
    const completedAt = new Date("2030-06-01T08:00:00.000Z").toISOString();
    expect(computeCronJobHealthFromLastRun(completedAt, 60, now).level).toBe("critical");
  });
});

describe("computeCronHealthFromBacklog", () => {
  it("is healthy with zero backlog", () => {
    expect(computeCronHealthFromBacklog(0).level).toBe("healthy");
  });

  it("is warning with small backlog", () => {
    expect(computeCronHealthFromBacklog(2, { criticalThreshold: 10 }).level).toBe("warning");
  });

  it("is critical with large backlog", () => {
    expect(computeCronHealthFromBacklog(12, { criticalThreshold: 10 }).level).toBe("critical");
  });
});

describe("mergeCronHealthLevels", () => {
  it("picks the most severe level", () => {
    expect(mergeCronHealthLevels("healthy", "warning", "unknown")).toBe("warning");
    expect(mergeCronHealthLevels("healthy", "critical")).toBe("critical");
  });
});
