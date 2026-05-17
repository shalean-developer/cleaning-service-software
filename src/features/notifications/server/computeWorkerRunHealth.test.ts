import { describe, expect, it } from "vitest";
import { computeWorkerRunHealth } from "./computeWorkerRunHealth";

describe("computeWorkerRunHealth", () => {
  const now = new Date("2026-05-17T12:00:00.000Z");

  it("returns unknown when no runs", () => {
    const health = computeWorkerRunHealth(null, now);
    expect(health.level).toBe("unknown");
  });

  it("returns healthy within 10 minutes", () => {
    const health = computeWorkerRunHealth("2026-05-17T11:55:00.000Z", now);
    expect(health.level).toBe("healthy");
    expect(health.ageMinutes).toBe(5);
  });

  it("returns warning between 10 and 15 minutes", () => {
    const health = computeWorkerRunHealth("2026-05-17T11:48:00.000Z", now);
    expect(health.level).toBe("warning");
    expect(health.ageMinutes).toBe(12);
  });

  it("returns critical after 15 minutes", () => {
    const health = computeWorkerRunHealth("2026-05-17T11:40:00.000Z", now);
    expect(health.level).toBe("critical");
    expect(health.ageMinutes).toBe(20);
  });
});
