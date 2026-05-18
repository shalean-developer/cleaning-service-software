import { describe, expect, it } from "vitest";
import {
  getRecurringPaymentExplanation,
  getRecurringScheduleExplanation,
  isRecurringFrequency,
} from "./recurringDisplay";

describe("recurringDisplay", () => {
  it("detects recurring frequencies", () => {
    expect(isRecurringFrequency("once")).toBe(false);
    expect(isRecurringFrequency("weekly")).toBe(true);
  });

  it("returns schedule explanations for recurring plans", () => {
    expect(getRecurringScheduleExplanation("weekly")).toContain("every week");
    expect(getRecurringScheduleExplanation("once")).toBeNull();
  });

  it("returns payment explanation only for recurring plans", () => {
    expect(getRecurringPaymentExplanation("monthly")).toContain("Today's payment");
    expect(getRecurringPaymentExplanation("once")).toBeNull();
  });
});
