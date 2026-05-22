import type { PricingFrequency } from "@/features/pricing/server/types";

/** Customer-facing payment note when cadence is not once-off (first booking only). */
export const PREFERRED_SCHEDULE_PAYMENT_EXPLANATION =
  "Your first payment confirms your first visit only. Future recurring visits are paid individually.";

/** Wizard step section title for cadence selection (regular / default). */
export const PREFERRED_SCHEDULE_SECTION_TITLE = "Preferred cleaning schedule";

/**
 * True when the customer selected a non-once cadence for pricing/display.
 * Does not imply automated future bookings or a materialized series.
 */
export function isPreferredCadenceFrequency(frequency: PricingFrequency): boolean {
  return frequency !== "once";
}

/** @deprecated Prefer {@link isPreferredCadenceFrequency}. name retained for callers. */
export const isRecurringFrequency = isPreferredCadenceFrequency;

export function getPreferredCadenceReviewNote(
  frequency: PricingFrequency,
): string | null {
  switch (frequency) {
    case "weekly":
      return "Preferred weekly schedule for this first booking only.";
    case "biweekly":
      return "Preferred every-2-weeks schedule for this first booking only.";
    case "monthly":
      return "Preferred monthly schedule for this first booking only.";
    default:
      return null;
  }
}

export function getPreferredCadenceScheduleExplanation(
  frequency: PricingFrequency,
): string | null {
  switch (frequency) {
    case "weekly":
      return "You prefer weekly visits. This checkout covers your first booking only; we'll help arrange follow-ups after that.";
    case "biweekly":
      return "You prefer a visit every two weeks. This checkout covers your first booking only; we'll help arrange follow-ups after that.";
    case "monthly":
      return "You prefer monthly visits. This checkout covers your first booking only; we'll help arrange follow-ups after that.";
    default:
      return null;
  }
}

export function buildFirstBookingCadenceDiscountLabel(frequency: PricingFrequency): string {
  const cadenceLabel =
    frequency === "weekly"
      ? "weekly"
      : frequency === "biweekly"
        ? "bi-weekly"
        : frequency === "monthly"
          ? "monthly"
          : frequency;
  return `First-booking cadence discount (${cadenceLabel})`;
}
