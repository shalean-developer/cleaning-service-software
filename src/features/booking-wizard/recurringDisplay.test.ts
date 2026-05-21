import { describe, expect, it } from "vitest";
import {
  getRecurringPaymentExplanation,
  getRecurringScheduleExplanation,
  getRecurringScheduleReviewNote,
  isRecurringFrequency,
} from "./recurringDisplay";
import { PREFERRED_SCHEDULE_PAYMENT_EXPLANATION } from "./preferredScheduleCopy";

describe("recurringDisplay", () => {
  it("detects preferred cadence frequencies without implying a series", () => {
    expect(isRecurringFrequency("once")).toBe(false);
    expect(isRecurringFrequency("weekly")).toBe(true);
  });

  it("returns preferred schedule explanations, not repeat automation", () => {
    expect(getRecurringScheduleExplanation("weekly")).toMatch(/first booking only/i);
    expect(getRecurringScheduleExplanation("weekly")).not.toMatch(/repeats/i);
    expect(getRecurringScheduleExplanation("once")).toBeNull();
  });

  it("returns preferred schedule review notes", () => {
    expect(getRecurringScheduleReviewNote("weekly")).toMatch(/preferred weekly/i);
    expect(getRecurringScheduleReviewNote("once")).toBeNull();
  });

  it("returns payment explanation only for non-once cadence", () => {
    expect(getRecurringPaymentExplanation("monthly")).toBe(
      PREFERRED_SCHEDULE_PAYMENT_EXPLANATION,
    );
    expect(getRecurringPaymentExplanation("once")).toBeNull();
  });
});
