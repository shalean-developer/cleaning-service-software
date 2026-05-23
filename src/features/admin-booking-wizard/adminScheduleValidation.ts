import {
  isScheduleWithinBookingWindow,
  resolveBookingWindowBounds,
  resolveScheduleDateTimeValidationMessage,
  resolveScheduleStepHelperCopy,
} from "@/features/booking-wizard/bookingWindowConfig";
import { buildWizardSlot, isSlotInPast } from "@/features/booking-wizard/slot";
import { WIZARD_TIMEZONE } from "@/features/booking-wizard/constants";

export type AdminScheduleValidation = {
  valid: boolean;
  message: string | null;
};

export function resolveAdminScheduleBounds(now: Date = new Date()) {
  return resolveBookingWindowBounds(now, process.env, { client: true });
}

export function resolveAdminScheduleHelperCopy(): string {
  const bounds = resolveAdminScheduleBounds();
  return `${resolveScheduleStepHelperCopy(bounds.extendedWindowEnabled)} Times use ${WIZARD_TIMEZONE}.`;
}

export function validateAdminSchedule(
  date: string,
  time: string,
  now: Date = new Date(),
): AdminScheduleValidation {
  const trimmedDate = date.trim();
  const trimmedTime = time.trim();

  if (!trimmedDate || !trimmedTime) {
    return { valid: false, message: "Select a service date and start time." };
  }

  const dateMessage = resolveScheduleDateTimeValidationMessage(trimmedDate, now, process.env, {
    client: true,
  });
  if (dateMessage) {
    return { valid: false, message: dateMessage };
  }

  if (isSlotInPast(trimmedDate, trimmedTime, now)) {
    return {
      valid: false,
      message: "Choose a future date and time (Africa/Johannesburg).",
    };
  }

  const slot = buildWizardSlot(trimmedDate, trimmedTime);
  if (!slot) {
    return { valid: false, message: "Enter a valid date and time." };
  }

  if (!isScheduleWithinBookingWindow(slot.scheduledStart, now, process.env)) {
    const bounds = resolveAdminScheduleBounds(now);
    return {
      valid: false,
      message: `Choose a date within the next ${bounds.maxAdvanceDays} days.`,
    };
  }

  return { valid: true, message: null };
}
