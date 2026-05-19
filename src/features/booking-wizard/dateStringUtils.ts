import { WIZARD_TIMEZONE } from "./constants";

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

export function calendarDaysBetween(startDate: string, endDate: string): number {
  const a = parseDateString(startDate);
  const b = parseDateString(endDate);
  const utcA = Date.UTC(a.y, a.m - 1, a.d);
  const utcB = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((utcB - utcA) / 86_400_000);
}

export function minBookableDateString(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIZARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}
