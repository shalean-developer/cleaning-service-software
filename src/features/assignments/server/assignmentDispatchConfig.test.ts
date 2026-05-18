import { afterEach, describe, expect, it } from "vitest";
import { getDeferredAssignmentConfig } from "./assignmentDispatchConfig";

describe("getDeferredAssignmentConfig", () => {
  afterEach(() => {
    delete process.env.DEFERRED_ASSIGNMENT_ENABLED;
    delete process.env.ASSIGNMENT_DISPATCH_LEAD_DAYS;
  });

  it("defaults to disabled with 14-day lead", () => {
    expect(getDeferredAssignmentConfig()).toEqual({
      enabled: false,
      dispatchLeadDays: 14,
    });
  });

  it("parses env overrides", () => {
    process.env.DEFERRED_ASSIGNMENT_ENABLED = "true";
    process.env.ASSIGNMENT_DISPATCH_LEAD_DAYS = "7";
    expect(getDeferredAssignmentConfig()).toEqual({
      enabled: true,
      dispatchLeadDays: 7,
    });
  });
});
