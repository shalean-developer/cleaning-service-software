import { ADMIN_BOOKING_WIZARD_STEPS, type AdminBookingWizardStep } from "./types";

export function adminWizardStepIndex(step: AdminBookingWizardStep): number {
  return ADMIN_BOOKING_WIZARD_STEPS.indexOf(step);
}

export function adminWizardNextStep(step: AdminBookingWizardStep): AdminBookingWizardStep | null {
  const idx = adminWizardStepIndex(step);
  if (idx < 0 || idx >= ADMIN_BOOKING_WIZARD_STEPS.length - 1) return null;
  return ADMIN_BOOKING_WIZARD_STEPS[idx + 1] ?? null;
}

export function adminWizardPreviousStep(step: AdminBookingWizardStep): AdminBookingWizardStep | null {
  const idx = adminWizardStepIndex(step);
  if (idx <= 0) return null;
  return ADMIN_BOOKING_WIZARD_STEPS[idx - 1] ?? null;
}
