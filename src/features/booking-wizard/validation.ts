import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";
import { normalizeAreaSlug } from "@/features/cleaners/server/eligibility/normalize";
import type { BookingWizardState, StepValidationResult, WizardStep } from "./types";
import { WIZARD_SERVICE_OPTIONS } from "./constants";
import { buildWizardSlot, isSlotInPast } from "./slot";

function result(valid: boolean, errors: Record<string, string> = {}): StepValidationResult {
  return { valid, errors };
}

export function validateServiceStep(state: BookingWizardState): StepValidationResult {
  if (!state.serviceSlug) {
    return result(false, { serviceSlug: "Please select a service." });
  }
  const enabled = WIZARD_SERVICE_OPTIONS.some(
    (s) => s.slug === state.serviceSlug && s.enabled,
  );
  if (!enabled) {
    return result(false, { serviceSlug: "This service is not available." });
  }
  return result(true);
}

export function validateDateTimeStep(state: BookingWizardState): StepValidationResult {
  const errors: Record<string, string> = {};
  if (!state.date.trim()) errors.date = "Date is required.";
  if (!state.time.trim()) errors.time = "Time is required.";

  if (state.date && state.time) {
    const slot = buildWizardSlot(state.date, state.time);
    if (!slot) {
      errors.time = "Enter a valid date and time.";
    } else if (isSlotInPast(state.date, state.time)) {
      errors.date = "Choose a future date and time (Africa/Johannesburg).";
    }
  }

  return result(Object.keys(errors).length === 0, errors);
}

export function validateLocationStep(state: BookingWizardState): StepValidationResult {
  const errors: Record<string, string> = {};
  if (!state.addressLine1.trim()) errors.addressLine1 = "Street address is required.";
  if (!state.suburb.trim()) errors.suburb = "Suburb is required.";
  if (!state.city.trim()) errors.city = "City is required.";
  const areaSlug = normalizeAreaSlug(state.suburb);
  if (state.suburb.trim() && !areaSlug) {
    errors.suburb = "Suburb could not be recognized.";
  }
  return result(Object.keys(errors).length === 0, errors);
}

export function validateDetailsStep(state: BookingWizardState): StepValidationResult {
  if (!state.serviceSlug) {
    return result(false, { serviceSlug: "Select a service first." });
  }

  const rule = SERVICE_CATALOG[state.serviceSlug];
  const errors: Record<string, string> = {};

  if (!Number.isInteger(state.bedrooms) || state.bedrooms < 0 || state.bedrooms > 20) {
    errors.bedrooms = "Bedrooms must be between 0 and 20.";
  } else if (!rule.allowZeroRooms && state.bedrooms < 1) {
    errors.bedrooms = "At least 1 bedroom is required.";
  }

  if (!Number.isInteger(state.bathrooms) || state.bathrooms < 0 || state.bathrooms > 20) {
    errors.bathrooms = "Bathrooms must be between 0 and 20.";
  } else if (!rule.allowZeroRooms && state.bathrooms < 1) {
    errors.bathrooms = "At least 1 bathroom is required.";
  }

  if (state.serviceSlug === "office-cleaning") {
    if (
      state.propertySizeSqm == null ||
      !Number.isFinite(state.propertySizeSqm) ||
      state.propertySizeSqm <= 0
    ) {
      errors.propertySizeSqm = "Property size (sqm) is required for office cleaning.";
    }
  }

  return result(Object.keys(errors).length === 0, errors);
}

export function validateCleanerStep(state: BookingWizardState): StepValidationResult {
  if (state.cleanerPreferenceMode === "best_available") {
    return result(true);
  }

  if (!state.selectedCleanerId) {
    return result(false, {
      selectedCleanerId: "Select a cleaner or choose Best available.",
    });
  }

  const card = state.availableCleaners.find(
    (c) => c.cleanerId === state.selectedCleanerId,
  );

  if (!card) {
    return result(false, {
      selectedCleanerId: "Selected cleaner is not in the current list. Refresh and try again.",
    });
  }

  if (card.eligibilityStatus !== "eligible") {
    return result(false, {
      selectedCleanerId: card.eligibilityReason || "This cleaner is not eligible.",
    });
  }

  return result(true);
}

export function validateReviewStep(state: BookingWizardState): StepValidationResult {
  const errors: Record<string, string> = {};
  if (!state.quote) {
    errors.quote = "Pricing quote is required. Go back and complete previous steps.";
  }
  if (!state.reviewConfirmed) {
    errors.reviewConfirmed = "Please confirm the booking details before continuing.";
  }
  return result(Object.keys(errors).length === 0, errors);
}

export function validateCheckoutStep(state: BookingWizardState): StepValidationResult {
  const review = validateReviewStep(state);
  if (!review.valid) return review;

  const cleaner = validateCleanerStep(state);
  if (!cleaner.valid) return cleaner;

  if (state.checkoutSubmitting) {
    return result(false, { checkout: "Payment is already in progress." });
  }

  return result(true);
}

export function validateWizardStep(
  step: WizardStep,
  state: BookingWizardState,
): StepValidationResult {
  switch (step) {
    case "service":
      return validateServiceStep(state);
    case "datetime":
      return validateDateTimeStep(state);
    case "location":
      return validateLocationStep(state);
    case "details":
      return validateDetailsStep(state);
    case "cleaner":
      return validateCleanerStep(state);
    case "review":
      return validateReviewStep(state);
    case "checkout":
      return validateCheckoutStep(state);
    default:
      return result(true);
  }
}

/** Validates all steps up to and including target (for checkout guard). */
export function validateStepsThrough(
  target: WizardStep,
  state: BookingWizardState,
): StepValidationResult {
  const order: WizardStep[] = [
    "service",
    "datetime",
    "location",
    "details",
    "cleaner",
    "review",
    "checkout",
  ];
  const targetIdx = order.indexOf(target);
  for (let i = 0; i <= targetIdx; i++) {
    const step = order[i]!;
    const check = validateWizardStep(step, state);
    if (!check.valid) return check;
  }
  return result(true);
}

export function canProceedToCheckout(state: BookingWizardState): boolean {
  return (
    validateStepsThrough("checkout", state).valid &&
    state.quote != null &&
    !state.checkoutSubmitting
  );
}
