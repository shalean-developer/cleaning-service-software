function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month: month - 1, day };
}

export function toIsoDateString(year: number, monthIndex: number, day: number): string {
  const month = String(monthIndex + 1).padStart(2, "0");
  const date = String(day).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

export function addDaysToIsoDate(dateStr: string, days: number): string {
  const { year, month, day } = parseIsoDate(dateStr);
  const utc = new Date(Date.UTC(year, month, day + days));
  return toIsoDateString(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

export function compareIsoDates(a: string, b: string): number {
  return a.localeCompare(b);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function todayIsoDateLocal(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function formatMarketingDisplayDate(dateStr: string): string {
  const noon = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(noon);
}

export function formatMonthYearLabel(year: number, monthIndex: number): string {
  const noon = new Date(year, monthIndex, 15, 12);
  return new Intl.DateTimeFormat("en-ZA", {
    month: "long",
    year: "numeric",
  }).format(noon);
}

export function monthIndexFromIso(dateStr: string): { year: number; monthIndex: number } {
  const { year, month } = parseIsoDate(dateStr);
  return { year, monthIndex: month };
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export type CalendarCell = {
  iso: string | null;
  day: number;
  disabled: boolean;
  isToday: boolean;
  isSelected: boolean;
};

export function buildMonthGrid(
  viewYear: number,
  viewMonthIndex: number,
  minDate: string,
  maxDate: string | undefined,
  selectedDate: string,
  today: string,
): CalendarCell[] {
  const firstWeekday = new Date(viewYear, viewMonthIndex, 1).getDay();
  const startOffset = (firstWeekday + 6) % 7;
  const totalDays = daysInMonth(viewYear, viewMonthIndex);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < startOffset; i++) {
    cells.push({
      iso: null,
      day: 0,
      disabled: true,
      isToday: false,
      isSelected: false,
    });
  }

  for (let day = 1; day <= totalDays; day++) {
    const iso = toIsoDateString(viewYear, viewMonthIndex, day);
    const beforeMin = compareIsoDates(iso, minDate) < 0;
    const afterMax = maxDate != null && compareIsoDates(iso, maxDate) > 0;

    cells.push({
      iso,
      day,
      disabled: beforeMin || afterMax,
      isToday: iso === today,
      isSelected: iso === selectedDate,
    });
  }

  return cells;
}

export function canNavigateMonth(
  viewYear: number,
  viewMonthIndex: number,
  direction: -1 | 1,
  minDate: string,
  maxDate: string | undefined,
): boolean {
  const targetMonth = viewMonthIndex + direction;
  const targetYear = viewYear + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const firstOfTarget = toIsoDateString(targetYear, normalizedMonth, 1);
  const lastOfTarget = toIsoDateString(
    targetYear,
    normalizedMonth,
    daysInMonth(targetYear, normalizedMonth),
  );

  if (direction < 0) {
    const minMonth = monthIndexFromIso(minDate);
    const minFirst = toIsoDateString(minMonth.year, minMonth.monthIndex, 1);
    return compareIsoDates(lastOfTarget, minFirst) >= 0;
  }

  if (maxDate == null) return true;
  const maxMonth = monthIndexFromIso(maxDate);
  const maxLast = toIsoDateString(
    maxMonth.year,
    maxMonth.monthIndex,
    daysInMonth(maxMonth.year, maxMonth.monthIndex),
  );
  return compareIsoDates(firstOfTarget, maxLast) <= 0;
}
