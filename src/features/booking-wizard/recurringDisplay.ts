import type { PricingFrequency } from "@/features/pricing/server/types";

export function isRecurringFrequency(frequency: PricingFrequency): boolean {
  return frequency !== "once";
}

/** Display-only copy for review / checkout — no billing logic. */
export function getRecurringScheduleExplanation(frequency: PricingFrequency): string | null {
  switch (frequency) {
    case "weekly":
      return "Repeats every week on the day and arrival time you selected.";
    case "biweekly":
      return "Repeats every two weeks on the day and arrival time you selected.";
    case "monthly":
      return "Repeats monthly on the day and arrival time you selected.";
    default:
      return null;
  }
}

/** Shorter review-step note — frequency label already appears in the summary strip. */
export function getRecurringScheduleReviewNote(frequency: PricingFrequency): string | null {
  switch (frequency) {
    case "weekly":
      return "Repeats weekly on this day and time.";
    case "biweekly":
      return "Repeats every 2 weeks on this day and time.";
    case "monthly":
      return "Repeats monthly on this day and time.";
    default:
      return null;
  }
}

/** Display-only — clarifies today's charge vs future visits. */
export function getRecurringPaymentExplanation(frequency: PricingFrequency): string | null {
  if (!isRecurringFrequency(frequency)) return null;

  return "Today's payment secures this booking only. We will confirm your recurring schedule after payment; future visits are arranged in your account without charging again at checkout.";
}
