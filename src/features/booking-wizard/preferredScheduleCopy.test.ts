import { describe, expect, it } from "vitest";
import {
  buildFirstBookingCadenceDiscountLabel,
  getPreferredCadenceReviewNote,
  getPreferredCadenceScheduleExplanation,
  isPreferredCadenceFrequency,
  PREFERRED_SCHEDULE_PAYMENT_EXPLANATION,
} from "./preferredScheduleCopy";
import {
  getRecurringPaymentExplanation,
  getRecurringScheduleExplanation,
  getRecurringScheduleReviewNote,
} from "./recurringDisplay";

describe("preferredScheduleCopy", () => {
  it("treats weekly, biweekly, and monthly as cadence preference only", () => {
    expect(isPreferredCadenceFrequency("once")).toBe(false);
    expect(isPreferredCadenceFrequency("weekly")).toBe(true);
    expect(isPreferredCadenceFrequency("biweekly")).toBe(true);
    expect(isPreferredCadenceFrequency("monthly")).toBe(true);
  });

  it("does not promise automated future bookings in customer copy", () => {
    for (const frequency of ["weekly", "biweekly", "monthly"] as const) {
      const review = getPreferredCadenceReviewNote(frequency);
      const explanation = getPreferredCadenceScheduleExplanation(frequency);
      expect(review).toMatch(/first booking/i);
      expect(review).not.toMatch(/repeats/i);
      expect(explanation).toMatch(/first booking/i);
      expect(explanation).not.toMatch(/repeats/i);
      expect(explanation).not.toMatch(/automatically/i);
    }
    expect(PREFERRED_SCHEDULE_PAYMENT_EXPLANATION).toMatch(/first booking/i);
    expect(PREFERRED_SCHEDULE_PAYMENT_EXPLANATION).not.toMatch(/recurring schedule/i);
    expect(PREFERRED_SCHEDULE_PAYMENT_EXPLANATION).not.toMatch(/automatically/i);
  });

  it("labels frequency discount as first-booking cadence", () => {
    expect(buildFirstBookingCadenceDiscountLabel("weekly")).toBe(
      "First-booking cadence discount (weekly)",
    );
    expect(buildFirstBookingCadenceDiscountLabel("biweekly")).toContain("bi-weekly");
  });
});

describe("recurringDisplay (preferred schedule wrappers)", () => {
  it("uses preferred schedule payment copy for regular cleaning", () => {
    expect(getRecurringPaymentExplanation("weekly", "regular-cleaning")).toBe(
      PREFERRED_SCHEDULE_PAYMENT_EXPLANATION,
    );
    expect(getRecurringScheduleReviewNote("monthly", "regular-cleaning")).toMatch(
      /preferred monthly/i,
    );
    expect(getRecurringScheduleExplanation("biweekly", "regular-cleaning")).toMatch(
      /first booking only/i,
    );
  });
});
