import { DEFAULT_ASSIGNMENT_DISPATCH_LEAD_DAYS } from "@/features/assignments/dispatchAtConstants";
import { WIZARD_TIMEZONE } from "./constants";
import {
  addDaysToDateString,
  calendarDaysBetween,
  minBookableDateString,
} from "./dateStringUtils";
import { buildWizardSlot } from "./slot";

/** Maximum advance booking window when extended horizon is enabled. */
export const BOOKING_MAX_ADVANCE_DAYS = 90;

/** Visible date cards per paginated window (do not raise to 90). */
export const VISIBLE_DATE_OPTION_COUNT = 7;

/** Default near-term horizon when extended public booking is not enabled. */
export const BOOKING_LEGACY_MAX_ADVANCE_DAYS = 14;

function parseBooleanEnv(raw: string | undefined, defaultValue = false): boolean {
  if (raw == null || raw.trim() === "") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return defaultValue;
}

export { calendarDaysBetween, minBookableDateString } from "./dateStringUtils";

/** Server / Node: BOOKING_EXTENDED_WINDOW_ENABLED */
export function isBookingExtendedWindowEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return parseBooleanEnv(env.BOOKING_EXTENDED_WINDOW_ENABLED, false);
}

/**
 * Browser: NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED
 *
 * Must read `process.env.NEXT_PUBLIC_*` directly — Next.js only inlines public env
 * vars for static property access, not `env[key]` or a passed `process.env` object.
 */
export function isClientBookingExtendedWindowEnabled(): boolean {
  return parseBooleanEnv(
    process.env.NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED,
    false,
  );
}

export function getEffectiveMaxAdvanceDays(
  env: Record<string, string | undefined> = process.env,
  options?: { client?: boolean },
): number {
  const enabled = options?.client
    ? isClientBookingExtendedWindowEnabled()
    : isBookingExtendedWindowEnabled(env);
  return enabled ? BOOKING_MAX_ADVANCE_DAYS : BOOKING_LEGACY_MAX_ADVANCE_DAYS;
}

export function maxBookableDateString(
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  options?: { client?: boolean },
): string {
  const minDate = minBookableDateString(now);
  return addDaysToDateString(
    minDate,
    getEffectiveMaxAdvanceDays(env, options),
  );
}

export type BookingWindowBounds = {
  minDate: string;
  maxDate: string;
  maxAdvanceDays: number;
  extendedWindowEnabled: boolean;
};

export function resolveBookingWindowBounds(
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  options?: { client?: boolean },
): BookingWindowBounds {
  const extendedWindowEnabled = options?.client
    ? isClientBookingExtendedWindowEnabled()
    : isBookingExtendedWindowEnabled(env);
  const minDate = minBookableDateString(now);
  const maxAdvanceDays = extendedWindowEnabled
    ? BOOKING_MAX_ADVANCE_DAYS
    : BOOKING_LEGACY_MAX_ADVANCE_DAYS;
  return {
    minDate,
    maxDate: addDaysToDateString(minDate, maxAdvanceDays),
    maxAdvanceDays,
    extendedWindowEnabled,
  };
}

export function isDateWithinBookingWindow(
  date: string,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  options?: { client?: boolean },
): boolean {
  const { minDate, maxDate } = resolveBookingWindowBounds(now, env, options);
  return date >= minDate && date <= maxDate;
}

export function clampDateToBookingWindow(
  date: string,
  bounds: Pick<BookingWindowBounds, "minDate" | "maxDate">,
): string {
  if (date < bounds.minDate) return bounds.minDate;
  if (date > bounds.maxDate) return bounds.maxDate;
  return date;
}

/** Align paginated window so `selectedDate` appears in the visible 7-card slice. */
export function resolveDateWindowStartOffsetForDate(
  minDate: string,
  selectedDate: string,
  maxDate: string,
  visibleCount: number = VISIBLE_DATE_OPTION_COUNT,
): number {
  if (!selectedDate || selectedDate < minDate) return 0;
  if (selectedDate > maxDate) {
    return resolveMaxDateWindowStartOffset(minDate, maxDate, visibleCount);
  }

  const dayIndex = calendarDaysBetween(minDate, selectedDate);
  const maxOffset = resolveMaxDateWindowStartOffset(minDate, maxDate, visibleCount);
  const aligned = Math.floor(dayIndex / visibleCount) * visibleCount;
  return Math.min(aligned, maxOffset);
}

export function resolveMaxDateWindowStartOffset(
  minDate: string,
  maxDate: string,
  visibleCount: number = VISIBLE_DATE_OPTION_COUNT,
): number {
  const span = calendarDaysBetween(minDate, maxDate);
  if (span + 1 <= visibleCount) return 0;
  return span - (visibleCount - 1);
}

export function canShiftDateWindowBack(windowStartOffsetDays: number): boolean {
  return windowStartOffsetDays > 0;
}

export function canShiftDateWindowForward(
  minDate: string,
  windowStartOffsetDays: number,
  maxDate: string,
  visibleCount: number = VISIBLE_DATE_OPTION_COUNT,
): boolean {
  const maxOffset = resolveMaxDateWindowStartOffset(minDate, maxDate, visibleCount);
  return windowStartOffsetDays < maxOffset;
}

export function scheduleStartToBookingDate(scheduledStart: string): string | null {
  const instant = new Date(scheduledStart);
  if (Number.isNaN(instant.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIZARD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function isScheduleWithinBookingWindow(
  scheduledStart: string,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): boolean {
  const date = scheduleStartToBookingDate(scheduledStart);
  if (!date) return false;
  return isDateWithinBookingWindow(date, now, env);
}

export function resolveScheduleDateTimeValidationMessageForBounds(
  date: string,
  bounds: BookingWindowBounds,
): string | null {
  if (date < bounds.minDate) {
    return "Choose a future date and time (Africa/Johannesburg).";
  }
  if (date > bounds.maxDate) {
    if (bounds.extendedWindowEnabled) {
      return `Choose a date within the next ${bounds.maxAdvanceDays} days.`;
    }
    return `Choose a date within the next ${bounds.maxAdvanceDays} days. Extended advance booking is not available yet.`;
  }
  return null;
}

export function resolveScheduleDateTimeValidationMessage(
  date: string,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
  options?: { client?: boolean },
): string | null {
  const bounds = resolveBookingWindowBounds(now, env, options);
  return resolveScheduleDateTimeValidationMessageForBounds(date, bounds);
}

export type BookingWindowEnvStatus = {
  serverExtendedEnabled: boolean;
  clientExtendedEnabled: boolean;
  mismatched: boolean;
  /** Effective horizon when both sides must agree (uses server flag). */
  serverMaxAdvanceDays: number;
  mismatchWarning: string | null;
};

/**
 * Launch requires BOOKING_EXTENDED_WINDOW_ENABLED (server) and
 * NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED (client) to match.
 */
export function resolveBookingWindowEnvStatus(
  env: Record<string, string | undefined> = process.env,
): BookingWindowEnvStatus {
  const serverExtendedEnabled = isBookingExtendedWindowEnabled(env);
  const clientExtendedEnabled = isClientBookingExtendedWindowEnabled();
  const mismatched = serverExtendedEnabled !== clientExtendedEnabled;
  const mismatchWarning = mismatched
    ? serverExtendedEnabled
      ? "Booking window flags are mismatched: server allows 90 days but the public client flag is off. Set NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED=true and redeploy."
      : "Booking window flags are mismatched: the public client shows extended dates but the server limit is 14 days. Set BOOKING_EXTENDED_WINDOW_ENABLED=true on the server."
    : null;
  return {
    serverExtendedEnabled,
    clientExtendedEnabled,
    mismatched,
    serverMaxAdvanceDays: serverExtendedEnabled
      ? BOOKING_MAX_ADVANCE_DAYS
      : BOOKING_LEGACY_MAX_ADVANCE_DAYS,
    mismatchWarning,
  };
}

/** Server lock rejection copy — matches wizard validation where possible. */
export function resolveScheduleOutsideWindowMessage(
  scheduledStart: string,
  now: Date = new Date(),
  env: Record<string, string | undefined> = process.env,
): string {
  const date = scheduleStartToBookingDate(scheduledStart);
  if (!date) {
    return "Booking date is outside the allowed advance booking window.";
  }
  const bounds = resolveBookingWindowBounds(now, env);
  const validationMessage = resolveScheduleDateTimeValidationMessageForBounds(date, bounds);
  const envStatus = resolveBookingWindowEnvStatus(env);
  const base =
    validationMessage ?? "Booking date is outside the allowed advance booking window.";
  if (envStatus.mismatched) {
    return `${base} (${envStatus.mismatchWarning})`;
  }
  return base;
}

/** True when assignment would be deferred until closer to service (display hint only). */
export function isOutsideImmediateAssignmentWindow(
  date: string,
  time: string,
  leadDays: number = DEFAULT_ASSIGNMENT_DISPATCH_LEAD_DAYS,
  now: Date = new Date(),
): boolean {
  const slot = buildWizardSlot(date, time || "12:00");
  if (!slot) return false;
  const startMs = Date.parse(slot.scheduledStart);
  if (Number.isNaN(startMs)) return false;
  const dispatchMs = startMs - leadDays * 86_400_000;
  return dispatchMs > now.getTime();
}

export function resolveScheduleStepHelperCopy(
  extendedWindowEnabled: boolean,
): string {
  if (extendedWindowEnabled) {
    return "Book up to 90 days ahead. Cleaner assignment happens closer to your service date.";
  }
  return "Choose your preferred service date. Future bookings are assigned closer to the service date.";
}
