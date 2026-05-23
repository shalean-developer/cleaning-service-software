import type { AdminBookingWizardStep } from "./types";
import type { AdminBookingWizardFormState } from "./draftFormState";
import { isAdminDraftFormReadyForSave } from "./draftFormState";
import { validateAdminSchedule } from "./adminScheduleValidation";

export type AdminStepValidation = {
  valid: boolean;
  message: string | null;
};

export function validateAdminWizardStep(
  step: AdminBookingWizardStep,
  form: AdminBookingWizardFormState,
): AdminStepValidation {
  switch (step) {
    case "customer":
      if (!form.selectedCustomer?.customerId.trim()) {
        return { valid: false, message: "Select or create a customer before continuing." };
      }
      return { valid: true, message: null };
    case "service":
      if (!form.serviceSlug) {
        return { valid: false, message: "Select a service before continuing." };
      }
      return { valid: true, message: null };
    case "schedule": {
      const schedule = validateAdminSchedule(form.date, form.time);
      return { valid: schedule.valid, message: schedule.message };
    }
    case "address":
      if (!form.addressLine1.trim() || !form.suburb.trim() || !form.city.trim()) {
        return {
          valid: false,
          message: "Enter street address, suburb, and city before continuing.",
        };
      }
      return { valid: true, message: null };
    case "pricing":
    case "payment":
    case "review":
      if (!isAdminDraftFormReadyForSave(form)) {
        return {
          valid: false,
          message: "Complete customer, service, schedule, and address before continuing.",
        };
      }
      return { valid: true, message: null };
    case "confirmation":
      return { valid: true, message: null };
    default:
      return { valid: true, message: null };
  }
}
