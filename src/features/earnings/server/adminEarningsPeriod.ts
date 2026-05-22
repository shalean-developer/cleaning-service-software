import { addDaysToDateString } from "@/features/booking-wizard/dateStringUtils";
import {
  ADMIN_OPERATIONS_TIMEZONE,
  johannesburgCalendarDayKey,
  johannesburgDayUtcBounds,
} from "@/lib/datetime/johannesburgDay";
import type { AdminEarningsPeriod } from "./adminEarningsDisplay";

export type AdminEarningsPeriodBounds = {
  period: AdminEarningsPeriod;
  startIso: string;
  endExclusiveIso: string;
  previousStartIso: string;
  previousEndExclusiveIso: string;
  periodMixLabel: string;
  revenueCardLabel: string;
};

/** Monday = 0 … Sunday = 6 in Johannesburg. */
function johannesburgIsoWeekdayIndex(dayKey: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: ADMIN_OPERATIONS_TIMEZONE,
    weekday: "short",
  }).format(new Date(`${dayKey}T12:00:00+02:00`));
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  return map[weekday] ?? 0;
}

function monthStartDayKey(dayKey: string): string {
  const [y, m] = dayKey.split("-");
  return `${y}-${m}-01`;
}

function nextMonthStartDayKey(dayKey: string): string {
  const start = monthStartDayKey(dayKey);
  const [y, m] = start.split("-").map(Number);
  const nextMonth = m === 12 ? 1 : m + 1;
  const nextYear = m === 12 ? y + 1 : y;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function weekStartMonday(dayKey: string): string {
  const index = johannesburgIsoWeekdayIndex(dayKey);
  return addDaysToDateString(dayKey, -index);
}

function isoWeekNumber(dayKey: string): number {
  const monday = weekStartMonday(dayKey);
  const thursday = addDaysToDateString(monday, 3);
  const yearStart = `${thursday.slice(0, 4)}-01-01`;
  const days = Math.floor(
    (Date.parse(`${thursday}T12:00:00+02:00`) - Date.parse(`${yearStart}T12:00:00+02:00`)) /
      86_400_000,
  );
  return Math.floor((days + 4) / 7) + 1;
}

function monthNameLabel(dayKey: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: ADMIN_OPERATIONS_TIMEZONE,
    month: "short",
  }).format(new Date(`${dayKey}T12:00:00+02:00`));
}

export function resolveAdminEarningsPeriodBounds(
  period: AdminEarningsPeriod,
  now: Date = new Date(),
): AdminEarningsPeriodBounds {
  const todayKey = johannesburgCalendarDayKey(now);

  if (period === "today") {
    const { startIso, endExclusiveIso } = johannesburgDayUtcBounds(todayKey);
    const yesterday = addDaysToDateString(todayKey, -1);
    const previous = johannesburgDayUtcBounds(yesterday);
    return {
      period,
      startIso,
      endExclusiveIso,
      previousStartIso: previous.startIso,
      previousEndExclusiveIso: previous.endExclusiveIso,
      periodMixLabel: "Today",
      revenueCardLabel: "Today revenue",
    };
  }

  if (period === "week") {
    const weekStart = weekStartMonday(todayKey);
    const weekEndExclusive = addDaysToDateString(weekStart, 7);
    const prevWeekStart = addDaysToDateString(weekStart, -7);
    const current = johannesburgDayUtcBounds(weekStart);
    const end = johannesburgDayUtcBounds(weekEndExclusive);
    const prev = johannesburgDayUtcBounds(prevWeekStart);
    const prevEnd = johannesburgDayUtcBounds(weekStart);
    return {
      period,
      startIso: current.startIso,
      endExclusiveIso: end.startIso,
      previousStartIso: prev.startIso,
      previousEndExclusiveIso: prevEnd.startIso,
      periodMixLabel: "This week",
      revenueCardLabel: "This week revenue",
    };
  }

  const monthStart = monthStartDayKey(todayKey);
  const monthEndExclusive = nextMonthStartDayKey(todayKey);
  const prevMonthStart = addDaysToDateString(monthStart, -1);
  const prevMonthStartKey = monthStartDayKey(prevMonthStart);
  const current = johannesburgDayUtcBounds(monthStart);
  const end = johannesburgDayUtcBounds(monthEndExclusive);
  const prev = johannesburgDayUtcBounds(prevMonthStartKey);
  const prevEnd = johannesburgDayUtcBounds(monthStart);

  return {
    period,
    startIso: current.startIso,
    endExclusiveIso: end.startIso,
    previousStartIso: prev.startIso,
    previousEndExclusiveIso: prevEnd.startIso,
    periodMixLabel: "This month",
    revenueCardLabel: "This month revenue",
  };
}

export function formatCleanerEarningsPeriodLabel(
  period: AdminEarningsPeriod,
  visitCount: number,
  dayKey: string = johannesburgCalendarDayKey(),
): string {
  const visits =
    visitCount === 1 ? "1 visit" : `${visitCount} visits`;
  switch (period) {
    case "today":
      return `Today · ${visits}`;
    case "week":
      return `Wk ${isoWeekNumber(dayKey)} · ${visits}`;
    case "month":
      return `${monthNameLabel(dayKey)} · ${visits}`;
  }
}
