import { WIZARD_TIMEZONE } from "./constants";
import { addDaysToDateString } from "./dateStringUtils";
import { isSlotInPast } from "./slot";

export { addDaysToDateString } from "./dateStringUtils";

/** Display-only preset arrival times (HH:mm). same format as native `type="time"` value. */
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

/** Build selectable day cards for a paginated window (display only). */
export function buildScheduleDateOptions(
  minDate: string,
  windowStartOffsetDays: number = 0,
  maxDate?: string,
  visibleCount: number = SCHEDULE_DATE_OPTION_COUNT,
): ScheduleDateOption[] {
  const windowStart = addDaysToDateString(minDate, windowStartOffsetDays);
  const options: ScheduleDateOption[] = [];

  for (let i = 0; i < visibleCount; i++) {
    const value = addDaysToDateString(windowStart, i);
    const disabled =
      compareDateStrings(value, minDate) < 0 ||
      (maxDate != null && compareDateStrings(value, maxDate) > 0);

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

const SCROLL_EDGE_THRESHOLD_PX = 2;

/** Whether the date scroller has horizontal overflow (display-only UI helper). */
export function scheduleDateScrollerHasOverflow(
  scrollWidth: number,
  clientWidth: number,
): boolean {
  return scrollWidth - clientWidth > SCROLL_EDGE_THRESHOLD_PX;
}

export type ScheduleDateScrollButtonsState = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

/** Derive arrow disabled state from scroller metrics (display-only UI helper). */
export function resolveScheduleDateScrollButtonsState(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): ScheduleDateScrollButtonsState {
  const maxScroll = scrollWidth - clientWidth;
  return {
    canScrollLeft: scrollLeft > SCROLL_EDGE_THRESHOLD_PX,
    canScrollRight: scrollLeft < maxScroll - SCROLL_EDGE_THRESHOLD_PX,
  };
}

export function listEnabledScheduleDateOptions(
  options: readonly ScheduleDateOption[],
): ScheduleDateOption[] {
  return options.filter((option) => !option.disabled);
}

export type ScheduleDateArrowNavigationState = {
  canGoPrevious: boolean;
  canGoNext: boolean;
};

/** When all date cards fit, arrows move selection across enabled options. */
export function resolveScheduleDateArrowNavigationState(
  options: readonly ScheduleDateOption[],
  selectedDate: string,
): ScheduleDateArrowNavigationState {
  const enabled = listEnabledScheduleDateOptions(options);
  if (enabled.length === 0) {
    return { canGoPrevious: false, canGoNext: false };
  }

  const index = enabled.findIndex((option) => option.value === selectedDate);
  if (index === -1) {
    return { canGoPrevious: false, canGoNext: enabled.length > 1 };
  }

  return {
    canGoPrevious: index > 0,
    canGoNext: index < enabled.length - 1,
  };
}

/** Next/previous enabled date value, or null when at the boundary / none selected. */
export function resolveAdjacentScheduleDateValue(
  options: readonly ScheduleDateOption[],
  selectedDate: string,
  direction: -1 | 1,
): string | null {
  const enabled = listEnabledScheduleDateOptions(options);
  if (enabled.length === 0) return null;

  const index = enabled.findIndex((option) => option.value === selectedDate);
  const targetIndex = index === -1 ? (direction === 1 ? 0 : enabled.length - 1) : index + direction;
  const target = enabled[targetIndex];
  return target?.value ?? null;
}

/** Pixel distance for one date-card scroll step (display-only UI helper). */
export function resolveScheduleDateScrollStepPx(
  cardWidth: number,
  gapPx: number = 6,
): number {
  if (cardWidth <= 0) return 72;
  return cardWidth + gapPx;
}
