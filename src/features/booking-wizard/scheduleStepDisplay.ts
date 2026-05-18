import { WIZARD_TIMEZONE } from "./constants";
import { isSlotInPast } from "./slot";

/** Display-only preset arrival times (HH:mm) — same format as native `type="time"` value. */
export const SCHEDULE_TIME_PRESETS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
] as const;

export type ScheduleDateOption = {
  value: string;
  dayLabel: string;
  dateLabel: string;
  disabled: boolean;
};

export const SCHEDULE_DATE_OPTION_COUNT = 7;

function parseDateString(value: string): { y: number; m: number; d: number } {
  const [y, m, d] = value.split("-").map(Number);
  return { y, m, d };
}

/** Add calendar days to an en-CA date string without timezone drift. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const { y, m, d } = parseDateString(dateStr);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function compareDateStrings(a: string, b: string): number {
  return a.localeCompare(b);
}

function formatWeekdayLabel(dateStr: string): string {
  const noon = new Date(`${dateStr}T12:00:00+02:00`);
  const weekday = new Intl.DateTimeFormat("en-ZA", {
    timeZone: WIZARD_TIMEZONE,
    weekday: "short",
  }).format(noon);
  return weekday.replace(/\./g, "").trim().toUpperCase();
}

function formatMonthDay(dateStr: string): string {
  const noon = new Date(`${dateStr}T12:00:00+02:00`);
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: WIZARD_TIMEZONE,
    month: "short",
    day: "numeric",
  }).format(noon);
}

/** Build selectable day cards from `minDate` forward (display only). */
export function buildScheduleDateOptions(
  minDate: string,
  count: number = SCHEDULE_DATE_OPTION_COUNT,
): ScheduleDateOption[] {
  const options: ScheduleDateOption[] = [];

  for (let i = 0; i < count; i++) {
    const value = addDaysToDateString(minDate, i);
    const disabled = compareDateStrings(value, minDate) < 0;

    options.push({
      value,
      dayLabel: formatWeekdayLabel(value),
      dateLabel: formatMonthDay(value),
      disabled,
    });
  }

  return options;
}

export function formatTimeSlotLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;

  const noon = new Date(`2000-01-01T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+02:00`);
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: WIZARD_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(noon);
}

/** Preset slots plus current value when it is not a preset (display only). */
export function resolveScheduleTimeSlots(selectedTime: string): string[] {
  const presets: string[] = [...SCHEDULE_TIME_PRESETS];
  if (selectedTime && !presets.includes(selectedTime)) {
    presets.push(selectedTime);
    presets.sort();
  }
  return presets;
}

/** Grey out slots that would fail existing past-slot validation for the chosen day. */
export function isScheduleTimeSlotDisabled(date: string, time: string): boolean {
  if (!date.trim()) return false;
  return isSlotInPast(date, time);
}
