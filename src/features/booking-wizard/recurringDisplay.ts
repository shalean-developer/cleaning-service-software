import type { PricingFrequency, ServiceSlug } from "@/features/pricing/server/types";
import {
  getRecurringPaymentExplanation as getAirbnbRecurringPaymentExplanation,
  getRecurringScheduleExplanation as getAirbnbRecurringScheduleExplanation,
  getRecurringScheduleReviewNote as getAirbnbRecurringScheduleReviewNote,
  isAirbnbCleaningSlug,
} from "./airbnbCleaningDisplay";
import { getCarpetCleaningReviewCopy } from "./carpetCleaningDisplay";
import { getMovingCleaningReviewCopy } from "./movingCleaningDisplay";
import {
  getPreferredCadenceReviewNote,
  getPreferredCadenceScheduleExplanation,
  isPreferredCadenceFrequency,
  PREFERRED_SCHEDULE_PAYMENT_EXPLANATION,
} from "./preferredScheduleCopy";
import { buildRecurringScheduleReviewLine } from "./recurringDaysWizard";

export {
  isPreferredCadenceFrequency,
  PREFERRED_SCHEDULE_PAYMENT_EXPLANATION,
  PREFERRED_SCHEDULE_SECTION_TITLE,
} from "./preferredScheduleCopy";

/** @deprecated Use {@link isPreferredCadenceFrequency}. */
export const isRecurringFrequency = isPreferredCadenceFrequency;

/** Display-only copy for review / checkout. no billing logic. */
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
  return getPreferredCadenceScheduleExplanation(frequency);
}

/** Shorter review-step note. frequency label already appears in the summary strip. */
export function getRecurringScheduleReviewNote(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null = null,
  options?: { selectedDays?: number[]; time?: string },
): string | null {
  const multiDayLine = buildRecurringScheduleReviewLine({
    frequency,
    selectedDays: options?.selectedDays ?? [],
    time: options?.time ?? "",
  });
  if (multiDayLine) return multiDayLine;

  const moving = getMovingCleaningReviewCopy(serviceSlug);
  if (moving) return moving.recurringScheduleReviewNote(frequency);
  const carpet = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpet) return carpet.recurringScheduleReviewNote(frequency);
  const airbnb = getAirbnbRecurringScheduleReviewNote(frequency, serviceSlug);
  if (airbnb) return airbnb;
  if (isAirbnbCleaningSlug(serviceSlug)) return null;
  return getPreferredCadenceReviewNote(frequency);
}

/** Display-only. clarifies today's charge vs follow-up visits. */
export function getRecurringPaymentExplanation(
  frequency: PricingFrequency,
  serviceSlug: ServiceSlug | null = null,
): string | null {
  if (!isPreferredCadenceFrequency(frequency)) return null;

  const moving = getMovingCleaningReviewCopy(serviceSlug);
  if (moving) return moving.recurringPaymentExplanation(frequency);
  const carpet = getCarpetCleaningReviewCopy(serviceSlug);
  if (carpet) return carpet.recurringPaymentExplanation(frequency);
  const airbnb = getAirbnbRecurringPaymentExplanation(frequency, serviceSlug);
  if (airbnb) return airbnb;

  return PREFERRED_SCHEDULE_PAYMENT_EXPLANATION;
}
