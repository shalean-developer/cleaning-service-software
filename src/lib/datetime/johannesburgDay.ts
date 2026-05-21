import { addDaysToDateString } from "@/features/booking-wizard/dateStringUtils";
import { scheduleStartToBookingDate } from "@/features/booking-wizard/bookingWindowConfig";
import { WIZARD_TIMEZONE } from "@/features/booking-wizard/constants";

/** Canonical operations timezone for Shalean admin dashboards. */
export const ADMIN_OPERATIONS_TIMEZONE = WIZARD_TIMEZONE;

/** Calendar day key (`YYYY-MM-DD`) in Africa/Johannesburg for the given instant. */
export function johannesburgCalendarDayKey(reference: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ADMIN_OPERATIONS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(reference);
}

/** UTC instants bounding a Johannesburg calendar day (half-open `[start, end)`). */
export function johannesburgDayUtcBounds(dayKey: string): {
  startIso: string;
  endExclusiveIso: string;
} {
  const start = new Date(`${dayKey}T00:00:00+02:00`);
  const nextDay = addDaysToDateString(dayKey, 1);
  const endExclusive = new Date(`${nextDay}T00:00:00+02:00`);
  return {
    startIso: start.toISOString(),
    endExclusiveIso: endExclusive.toISOString(),
  };
}

export function isScheduledOnJohannesburgDay(
  scheduledStart: string | undefined,
  dayKey: string,
): boolean {
  if (!scheduledStart) return false;
  return scheduleStartToBookingDate(scheduledStart) === dayKey;
}
