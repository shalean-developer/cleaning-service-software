import { describe, expect, it } from "vitest";
import {
  buildRecurringScheduleReviewLine,
  validateRecurringDays,
} from "./recurringDaysWizard";

describe("recurringDaysWizard", () => {
  it("validates weekly multi-day selection", () => {
    expect(validateRecurringDays("weekly", [])).toMatch(/at least one/i);
    expect(validateRecurringDays("weekly", [1, 3, 5])).toBeNull();
    expect(validateRecurringDays("once", [])).toBeNull();
  });

  it("builds review summary line", () => {
    expect(
      buildRecurringScheduleReviewLine({
        frequency: "weekly",
        selectedDays: [1, 3, 5],
        time: "09:00",
      }),
    ).toBe("Weekly recurring schedule: Mon · Wed · Fri at 09:00");
  });
});
