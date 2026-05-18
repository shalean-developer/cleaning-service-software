import { describe, expect, it } from "vitest";
import {
  computeAssignmentDispatchAt,
  daysUntilDispatch,
  isAssignmentDeferred,
  shouldRunAssignmentNow,
} from "./computeAssignmentDispatchAt";

describe("computeAssignmentDispatchAt", () => {
  it("subtracts lead days from scheduled_start instant", () => {
    const scheduledStart = "2026-06-15T10:00:00.000Z";
    expect(computeAssignmentDispatchAt(scheduledStart, 14)).toBe("2026-06-01T10:00:00.000Z");
  });

  it("allows same-day dispatch when lead is zero", () => {
    const scheduledStart = "2026-06-15T10:00:00.000Z";
    const dispatchAt = computeAssignmentDispatchAt(scheduledStart, 0);
    expect(dispatchAt).toBe(scheduledStart);
    expect(shouldRunAssignmentNow(dispatchAt, new Date("2026-06-15T10:00:00.000Z"))).toBe(true);
  });

  it("detects deferred vs ready windows", () => {
    const dispatchAt = "2026-06-01T10:00:00.000Z";
    const before = new Date("2026-05-31T23:59:59.000Z");
    const after = new Date("2026-06-01T10:00:00.000Z");
    expect(isAssignmentDeferred(dispatchAt, before)).toBe(true);
    expect(shouldRunAssignmentNow(dispatchAt, before)).toBe(false);
    expect(isAssignmentDeferred(dispatchAt, after)).toBe(false);
    expect(shouldRunAssignmentNow(dispatchAt, after)).toBe(true);
  });

  it("computes whole days until dispatch", () => {
    expect(
      daysUntilDispatch("2026-06-10T00:00:00.000Z", new Date("2026-06-08T12:00:00.000Z")),
    ).toBe(2);
  });
});
