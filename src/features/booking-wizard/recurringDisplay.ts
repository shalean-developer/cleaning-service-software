import type { PricingFrequency, ServiceSlug } from "@/features/pricing/server/types";
import {
  getRecurringPaymentExplanation as getAirbnbRecurringPaymentExplanation,
  getRecurringScheduleExplanation as getAirbnbRecurringScheduleExplanation,
  getRecurringScheduleReviewNote as getAirbnbRecurringScheduleReviewNote,
  isAirbnbCleaningSlug,
} from "./airbnbCleaningDisplay";
import { getCarpetCleaningReviewCopy } from "./carpetCleaningDisplay";
import { getMovingCleaningReviewCopy } from "./movingCleaningDisplay";

export function isRecurringFrequency(frequency: PricingFrequency): boolean {
  return frequency !== "once";
}

/** Display-only copy for review / checkout — no billing logic. */
export function getRecurringScheduleExplanation(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null = null,
): string | null {
  const moving = getMovingCleaningReviewCopy(serviceSlug);
  if (moving) return moving.recurringScheduleExplanation(frequency);
  const carpet = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpet) return carpet.recurringScheduleExplanation(frequency);
  const airbnb = getAirbnbRecurringScheduleExplanation(frequency, serviceSlug);
  if (airbnb) return airbnb;
  if (isAirbnbCleaningSlug(serviceSlug)) return null;
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
export function getRecurringScheduleReviewNote(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null = null,
): string | null {
  const moving = getMovingCleaningReviewCopy(serviceSlug);
  if (moving) return moving.recurringScheduleReviewNote(frequency);
  const carpet = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpet) return carpet.recurringScheduleReviewNote(frequency);
  const airbnb = getAirbnbRecurringScheduleReviewNote(frequency, serviceSlug);
  if (airbnb) return airbnb;
  if (isAirbnbCleaningSlug(serviceSlug)) return null;
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
export function getRecurringPaymentExplanation(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null = null,
): string | null {
  if (!isRecurringFrequency(frequency)) return null;

  const moving = getMovingCleaningReviewCopy(serviceSlug);
  if (moving) return moving.recurringPaymentExplanation(frequency);
  const carpet = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpet) return carpet.recurringPaymentExplanation(frequency);
  const airbnb = getAirbnbRecurringPaymentExplanation(frequency, serviceSlug);
  if (airbnb) return airbnb;

  return "Today's payment secures this booking only. We will confirm your recurring schedule after payment; future visits are arranged in your account without charging again at checkout.";
}
