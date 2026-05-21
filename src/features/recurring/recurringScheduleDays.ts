import { WIZARD_TIMEZONE } from "@/features/booking-wizard/constants";
import type { PricingFrequency } from "@/features/pricing/server/types";
import { parseJohannesburgParts } from "./recurrenceDateEngine";

const MS_PER_DAY = 86_400_000;
import type { RecurringSeriesFrequency } from "./types";

/** 0 = Sunday … 6 = Saturday (matches cleaner_availability.day_of_week). */
export const RECURRING_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const RECURRING_WEEKDAY_FULL_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const MAX_RECURRING_DAYS_PER_WEEK = 7;
export const MIN_RECURRING_DAYS_PER_WEEK = 1;

export function isMultiDayGroupFrequency(
  frequency: PricingFrequency | RecurringSeriesFrequency,
): boolean {
  return frequency === "weekly" || frequency === "biweekly";
}

export function normalizeSelectedDays(days: number[]): number[] {
  const unique = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  return unique.sort((a, b) => a - b);
}

export function weekdayFromJohannesburgInstant(iso: string): number {
  const parts = parseJohannesburgParts(new Date(iso));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: WIZARD_TIMEZONE,
    weekday: "short",
  });
  const label = formatter.format(new Date(iso));
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[label] ?? parts.day % 7;
}

/** Days from `fromDay` forward to reach `toDay` (0–6), same calendar week when possible. */
export function daysUntilWeekday(fromDay: number, toDay: number): number {
  if (toDay >= fromDay) return toDay - fromDay;
  return 7 - fromDay + toDay;
}

/** Wall-clock anchor for a weekday slot sharing paid visit time-of-day. */
export function resolveSlotAnchorScheduledStart(
  paidScheduledStartIso: string,
  targetWeekday: number,
): string {
  const paidDay = weekdayFromJohannesburgInstant(paidScheduledStartIso);
  const offsetDays = daysUntilWeekday(paidDay, targetWeekday);
  return new Date(
    new Date(paidScheduledStartIso).getTime() + offsetDays * MS_PER_DAY,
  ).toISOString();
}

export function formatSelectedDaysShort(days: number[]): string {
  return normalizeSelectedDays(days)
    .map((d) => RECURRING_WEEKDAY_LABELS[d] ?? String(d))
    .join(" · ");
}

export function formatSelectedDaysLong(days: number[]): string {
  return normalizeSelectedDays(days)
    .map((d) => RECURRING_WEEKDAY_FULL_LABELS[d] ?? String(d))
    .join(", ");
}

export function slotLabelForWeekday(weekday: number): string {
  return RECURRING_WEEKDAY_FULL_LABELS[weekday] ?? `Day ${weekday}`;
}

export function readSelectedDaysFromBookingMetadata(
  metadata: unknown,
): number[] | null {
  const record =
    metadata != null && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const schedule = record.recurringSchedule;
  if (schedule != null && typeof schedule === "object" && !Array.isArray(schedule)) {
    const raw = (schedule as Record<string, unknown>).selectedDays;
    if (Array.isArray(raw)) {
      const days = normalizeSelectedDays(raw.map((v) => Number(v)));
      if (days.length >= MIN_RECURRING_DAYS_PER_WEEK) return days;
    }
  }
  return null;
}

export function shouldMaterializeScheduleGroup(
  frequency: RecurringSeriesFrequency | null,
  selectedDays: number[] | null,
): boolean {
  if (!frequency || !selectedDays) return false;
  if (!isMultiDayGroupFrequency(frequency)) return false;
  return selectedDays.length > 1;
}

export function buildScheduleGroupLabel(
  frequency: "weekly" | "biweekly",
  selectedDays: number[],
  timeLabel: string,
): string {
  const cadence = frequency === "weekly" ? "Weekly" : "Bi-weekly";
  return `${cadence} recurring schedule: ${formatSelectedDaysShort(selectedDays)} at ${timeLabel}`;
}
