import type { PricingFrequency } from "@/features/pricing/server/types";
import {
  isMultiDayGroupFrequency,
  normalizeSelectedDays,
} from "@/features/recurring/recurringScheduleDays";

/** Map YYYY-MM-DD in wizard to 0=Sun … 6=Sat (Africa/Johannesburg). */
export function weekdayFromDateString(date: string): number {
  if (!date.trim()) return 1;
  const [y, m, d] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return utc.getUTCDay();
}

export function showRecurringDaysSelector(frequency: PricingFrequency): boolean {
  return isMultiDayGroupFrequency(frequency);
}

export function defaultRecurringDaysForDate(date: string, existing: number[] | undefined): number[] {
  if (existing && existing.length > 0) return normalizeSelectedDays(existing);
  return [weekdayFromDateString(date)];
}

export function validateRecurringDays(
  frequency: PricingFrequency,
  days: number[],
): string | null {
  if (!showRecurringDaysSelector(frequency)) return null;
  const normalized = normalizeSelectedDays(days);
  if (normalized.length < 1) {
    return "Select at least one recurring day.";
  }
  if (normalized.length > 7) {
    return "You can select up to 7 days per week.";
  }
  return null;
}

export function buildRecurringScheduleReviewLine(input: {
  frequency: PricingFrequency;
  selectedDays: number[];
  time: string;
}): string | null {
  if (!showRecurringDaysSelector(input.frequency) || input.selectedDays.length === 0) {
    return null;
  }
  const cadence = input.frequency === "weekly" ? "Weekly" : "Bi-weekly";
  const days = normalizeSelectedDays(input.selectedDays)
    .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d] ?? "")
    .filter(Boolean)
    .join(" · ");
  const time = input.time.trim() || "—";
  return `${cadence} recurring schedule: ${days} at ${time}`;
}
