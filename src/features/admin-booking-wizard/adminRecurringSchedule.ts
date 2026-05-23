import type { PricingFrequency } from "@/features/pricing/server/types";
import {
  formatSelectedDaysLong,
  normalizeSelectedDays,
  RECURRING_WEEKDAY_FULL_LABELS,
} from "@/features/recurring/recurringScheduleDays";
import {
  defaultRecurringDaysForDate,
  weekdayFromDateString,
} from "@/features/booking-wizard/recurringDaysWizard";

/**
 * Admin-assisted booking recurring schedule UX (scheduling metadata only).
 *
 * Backend compatibility (existing engine — not modified in this phase):
 * - Materialization supports weekly (+7d), biweekly (+14d), and monthly cadences.
 * - Multi-weekday weekly/biweekly uses `recurringSchedule.selectedDays` (same as customer wizard).
 * - Arbitrary intervals (every 3+ weeks) are rejected — no silent fallback to weekly.
 * - Monthly custom weekday patterns are not supported; use preset monthly frequency.
 */

/** Admin wizard frequency — `custom` is UI-only; pricing uses mapped weekly/biweekly. */
export type AdminBookingWizardFrequency = PricingFrequency | "custom";

export const ADMIN_BOOKING_WIZARD_FREQUENCY_OPTIONS: {
  value: AdminBookingWizardFrequency;
  label: string;
}[] = [
  { value: "once", label: "Once-off" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom recurring" },
];

export const ADMIN_RECURRING_INTERVAL_MIN_WEEKS = 1;
export const ADMIN_RECURRING_INTERVAL_MAX_WEEKS = 12;

/** Intervals the post-payment recurring engine materializes today (7 / 14-day steps). */
export const ADMIN_RECURRING_ENGINE_SUPPORTED_INTERVAL_WEEKS = new Set([1, 2]);

export type AdminRecurringScheduleMetadata = {
  selectedDays: number[];
  intervalWeeks?: number;
  configuredVia: "admin_wizard_custom" | "admin_wizard_preset";
};

export function adminWizardShowsRecurringBuilder(
  frequency: AdminBookingWizardFrequency,
): boolean {
  return frequency === "custom" || frequency === "weekly" || frequency === "biweekly";
}

export function resolveAdminPricingFrequency(input: {
  frequency: AdminBookingWizardFrequency;
  recurringIntervalWeeks: number;
}): PricingFrequency {
  if (input.frequency === "custom") {
    if (input.recurringIntervalWeeks <= 1) return "weekly";
    if (input.recurringIntervalWeeks === 2) return "biweekly";
    return "weekly";
  }
  return input.frequency;
}

export function resolveAdminRecurringIntervalWeeks(input: {
  frequency: AdminBookingWizardFrequency;
  recurringIntervalWeeks: number;
}): number {
  if (input.frequency === "biweekly") return 2;
  if (input.frequency === "weekly") return 1;
  if (input.frequency === "custom") return input.recurringIntervalWeeks;
  return 1;
}

export function validateAdminRecurringIntervalWeeks(intervalWeeks: number): string | null {
  if (!Number.isInteger(intervalWeeks)) {
    return "Recurrence interval must be a whole number of weeks.";
  }
  if (intervalWeeks < ADMIN_RECURRING_INTERVAL_MIN_WEEKS) {
    return `Interval must be at least ${ADMIN_RECURRING_INTERVAL_MIN_WEEKS} week.`;
  }
  if (intervalWeeks > ADMIN_RECURRING_INTERVAL_MAX_WEEKS) {
    return `Interval cannot exceed ${ADMIN_RECURRING_INTERVAL_MAX_WEEKS} weeks.`;
  }
  if (!ADMIN_RECURRING_ENGINE_SUPPORTED_INTERVAL_WEEKS.has(intervalWeeks)) {
    return `Every ${intervalWeeks} weeks is not supported yet. Use every 1 week (weekly) or every 2 weeks (bi-weekly).`;
  }
  return null;
}

export function validateAdminRecurringSchedule(input: {
  frequency: AdminBookingWizardFrequency;
  recurringDays: number[];
  recurringIntervalWeeks: number;
}): string | null {
  if (!adminWizardShowsRecurringBuilder(input.frequency)) {
    return null;
  }

  const days = normalizeSelectedDays(input.recurringDays);
  if (days.length < 1) {
    return "Select at least one recurring weekday.";
  }

  if (input.frequency === "custom") {
    return validateAdminRecurringIntervalWeeks(input.recurringIntervalWeeks);
  }

  if (input.frequency === "weekly" && input.recurringIntervalWeeks !== 1) {
    return null;
  }

  return null;
}

function formatDayList(days: number[]): string {
  const labels = normalizeSelectedDays(days).map((d) => RECURRING_WEEKDAY_FULL_LABELS[d] ?? "");
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export function formatAdminRecurringScheduleSummary(input: {
  frequency: AdminBookingWizardFrequency;
  recurringDays: number[];
  recurringIntervalWeeks: number;
  time?: string;
}): string | null {
  const days = normalizeSelectedDays(input.recurringDays);
  const intervalWeeks = resolveAdminRecurringIntervalWeeks(input);

  if (input.frequency === "once") return null;

  if (input.frequency === "monthly") {
    return "Monthly recurring visit";
  }

  if (!adminWizardShowsRecurringBuilder(input.frequency) || days.length === 0) {
    return null;
  }

  const dayPhrase = formatDayList(days);
  const timeSuffix = input.time?.trim() ? ` at ${input.time.trim()}` : "";

  if (intervalWeeks === 1) {
    if (days.length === 1) {
      return `Every ${dayPhrase}${timeSuffix}`;
    }
    return `Every ${dayPhrase}${timeSuffix}`;
  }

  if (days.length === 1) {
    return `Every ${intervalWeeks} weeks on ${dayPhrase}${timeSuffix}`;
  }

  return `Every ${intervalWeeks} weeks on ${formatSelectedDaysLong(days)}${timeSuffix}`;
}

export function formatAdminFrequencyDisplayLabel(
  frequency: AdminBookingWizardFrequency,
  recurringIntervalWeeks: number,
): string {
  if (frequency === "custom") {
    return `Custom (every ${recurringIntervalWeeks} week${recurringIntervalWeeks === 1 ? "" : "s"})`;
  }
  return frequency.replace(/_/g, " ");
}

export function buildAdminRecurringScheduleMetadata(input: {
  frequency: AdminBookingWizardFrequency;
  recurringDays: number[];
  recurringIntervalWeeks: number;
  scheduleDate: string;
}): AdminRecurringScheduleMetadata | null {
  if (!adminWizardShowsRecurringBuilder(input.frequency)) {
    return null;
  }

  const selectedDays = defaultRecurringDaysForDate(
    input.scheduleDate,
    normalizeSelectedDays(input.recurringDays),
  );
  const intervalWeeks = resolveAdminRecurringIntervalWeeks(input);

  return {
    selectedDays,
    intervalWeeks: input.frequency === "custom" ? intervalWeeks : undefined,
    configuredVia: input.frequency === "custom" ? "admin_wizard_custom" : "admin_wizard_preset",
  };
}

export function defaultAdminRecurringDaysForSchedule(
  scheduleDate: string,
  existing: number[] | undefined,
): number[] {
  return defaultRecurringDaysForDate(scheduleDate, existing);
}

export function adminRecurringScheduleAffectsPricing(
  frequency: AdminBookingWizardFrequency,
): boolean {
  return frequency !== "once";
}

/** Human-readable weekday chips label for review panels. */
export function formatAdminRecurringDaysChipLabel(days: number[]): string {
  return formatSelectedDaysLong(days);
}

export function isUnsupportedAdminRecurringPattern(input: {
  frequency: AdminBookingWizardFrequency;
  recurringIntervalWeeks: number;
}): boolean {
  if (input.frequency !== "custom") return false;
  return !ADMIN_RECURRING_ENGINE_SUPPORTED_INTERVAL_WEEKS.has(input.recurringIntervalWeeks);
}

export function validateAdminRecurringScheduleForDraftBody(input: {
  pricingFrequency: PricingFrequency;
  recurringSchedule?: AdminRecurringScheduleMetadata | null;
}): string | null {
  const { pricingFrequency, recurringSchedule } = input;

  if (pricingFrequency === "once" || pricingFrequency === "monthly") {
    if (recurringSchedule && recurringSchedule.selectedDays.length > 0) {
      return "Recurring weekday schedule is only supported for weekly and bi-weekly bookings.";
    }
    return null;
  }

  if (!recurringSchedule) {
    return null;
  }

  const intervalWeeks =
    recurringSchedule.intervalWeeks ?? (pricingFrequency === "biweekly" ? 2 : 1);

  const scheduleError = validateAdminRecurringSchedule({
    frequency:
      recurringSchedule.configuredVia === "admin_wizard_custom" ? "custom" : pricingFrequency,
    recurringDays: recurringSchedule.selectedDays,
    recurringIntervalWeeks: intervalWeeks,
  });
  if (scheduleError) return scheduleError;

  if (recurringSchedule.intervalWeeks !== undefined) {
    const intervalError = validateAdminRecurringIntervalWeeks(recurringSchedule.intervalWeeks);
    if (intervalError) return intervalError;

    const expectedFrequency =
      recurringSchedule.intervalWeeks <= 1 ? "weekly" : "biweekly";
    if (pricingFrequency !== expectedFrequency) {
      return `Pricing frequency "${pricingFrequency}" does not match the ${recurringSchedule.intervalWeeks}-week recurrence interval.`;
    }
  }

  return null;
}

export { weekdayFromDateString };
