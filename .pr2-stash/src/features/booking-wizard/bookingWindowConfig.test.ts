import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOOKING_LEGACY_MAX_ADVANCE_DAYS,
  BOOKING_MAX_ADVANCE_DAYS,
  VISIBLE_DATE_OPTION_COUNT,
  calendarDaysBetween,
  canShiftDateWindowBack,
  canShiftDateWindowForward,
  getEffectiveMaxAdvanceDays,
  isDateWithinBookingWindow,
  isOutsideImmediateAssignmentWindow,
  isScheduleWithinBookingWindow,
  maxBookableDateString,
  minBookableDateString,
  resolveBookingWindowBounds,
  resolveDateWindowStartOffsetForDate,
  resolveMaxDateWindowStartOffset,
  resolveScheduleDateTimeValidationMessage,
  scheduleStartToBookingDate,
} from "./bookingWindowConfig";
import { addDaysToDateString, buildScheduleDateOptions } from "./scheduleStepDisplay";

describe("bookingWindowConfig", () => {
  const now = new Date("2026-05-18T10:00:00+02:00");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("uses legacy 14-day horizon when extended window flag is off", () => {
    vi.stubEnv("BOOKING_EXTENDED_WINDOW_ENABLED", "false");
    vi.stubEnv("NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED", "false");
    expect(getEffectiveMaxAdvanceDays()).toBe(BOOKING_LEGACY_MAX_ADVANCE_DAYS);
    expect(maxBookableDateString()).toBe("2026-06-01");
  });

  it("uses 90-day horizon when extended window flag is on", () => {
    vi.stubEnv("BOOKING_EXTENDED_WINDOW_ENABLED", "true");
    expect(getEffectiveMaxAdvanceDays()).toBe(BOOKING_MAX_ADVANCE_DAYS);
    expect(maxBookableDateString()).toBe("2026-08-16");
  });

  it("resolves client booking bounds from NEXT_PUBLIC flag directly", () => {
    vi.stubEnv("BOOKING_EXTENDED_WINDOW_ENABLED", "false");
    vi.stubEnv("NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED", "true");
    const bounds = resolveBookingWindowBounds(now, undefined, { client: true });
    expect(bounds.extendedWindowEnabled).toBe(true);
    expect(bounds.maxAdvanceDays).toBe(BOOKING_MAX_ADVANCE_DAYS);
    expect(bounds.maxDate).toBe("2026-08-16");
  });

  it("accepts exact max-date boundary and rejects day after", () => {
    vi.stubEnv("BOOKING_EXTENDED_WINDOW_ENABLED", "true");
    const min = minBookableDateString();
    const max = maxBookableDateString();
    expect(isDateWithinBookingWindow(max, now)).toBe(true);
    expect(isDateWithinBookingWindow(addDaysToDateString(max, 1), now)).toBe(false);
    expect(calendarDaysBetween(min, max)).toBe(BOOKING_MAX_ADVANCE_DAYS);
  });

  it("validates schedule instants against booking window on server env", () => {
    vi.stubEnv("BOOKING_EXTENDED_WINDOW_ENABLED", "true");
    const max = maxBookableDateString();
    const within = `${max}T10:00:00+02:00`;
    const beyond = `${addDaysToDateString(max, 1)}T10:00:00+02:00`;
    expect(isScheduleWithinBookingWindow(within, now)).toBe(true);
    expect(isScheduleWithinBookingWindow(beyond, now)).toBe(false);
    expect(scheduleStartToBookingDate(within)).toBe(max);
  });

  it("keeps June dates inside the 90-day window enabled on paginated cards", () => {
    const min = "2026-05-18";
    const max = addDaysToDateString(min, BOOKING_MAX_ADVANCE_DAYS);
    const juneWeekOffset = 14;
    const juneWeek = buildScheduleDateOptions(min, juneWeekOffset, max);

    expect(juneWeek[0]?.value).toBe("2026-06-01");
    expect(juneWeek.every((option) => !option.disabled)).toBe(true);
    expect(juneWeek.some((option) => option.value === "2026-06-07" && !option.disabled)).toBe(
      true,
    );
  });

  it("paginates date cards in 7-day windows and disables beyond max", () => {
    vi.stubEnv("NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED", "true");
    const min = "2026-05-18";
    const max = addDaysToDateString(min, BOOKING_MAX_ADVANCE_DAYS);
    const first = buildScheduleDateOptions(min, 0, max);
    expect(first).toHaveLength(VISIBLE_DATE_OPTION_COUNT);
    expect(first[0]?.value).toBe("2026-05-18");
    expect(first[6]?.value).toBe("2026-05-24");

    const next = buildScheduleDateOptions(min, 7, max);
    expect(next[0]?.value).toBe("2026-05-25");

    const lastOffset = resolveMaxDateWindowStartOffset(min, max);
    const last = buildScheduleDateOptions(min, lastOffset, max);
    expect(last.some((o) => o.value === max && !o.disabled)).toBe(true);
    expect(last.some((o) => o.value > max)).toBe(false);
  });

  it("limits legacy 14-day mode and still surfaces the max bookable day", () => {
    const min = "2026-05-18";
    const max = addDaysToDateString(min, BOOKING_LEGACY_MAX_ADVANCE_DAYS);
    const maxOffset = resolveMaxDateWindowStartOffset(min, max);
    expect(maxOffset).toBe(8);
    expect(canShiftDateWindowForward(min, 0, max)).toBe(true);
    expect(canShiftDateWindowForward(min, 7, max)).toBe(true);
    expect(canShiftDateWindowForward(min, maxOffset, max)).toBe(false);
    const finalWindow = buildScheduleDateOptions(min, maxOffset, max);
    expect(finalWindow.every((option) => !option.disabled)).toBe(true);
    expect(finalWindow.at(-1)?.value).toBe(max);
  });

  it("shifts windows by 7 days with correct arrow bounds", () => {
    const min = "2026-05-18";
    const max = addDaysToDateString(min, BOOKING_MAX_ADVANCE_DAYS);
    expect(canShiftDateWindowBack(0)).toBe(false);
    expect(canShiftDateWindowBack(7)).toBe(true);
    expect(canShiftDateWindowForward(min, 0, max)).toBe(true);
    const maxOffset = resolveMaxDateWindowStartOffset(min, max);
    expect(canShiftDateWindowForward(min, maxOffset, max)).toBe(false);
  });

  it("aligns visible window to a native-selected date", () => {
    const min = "2026-05-18";
    const max = addDaysToDateString(min, BOOKING_MAX_ADVANCE_DAYS);
    expect(resolveDateWindowStartOffsetForDate(min, "2026-06-10", max)).toBe(21);
    expect(resolveDateWindowStartOffsetForDate(min, max, max)).toBe(
      resolveMaxDateWindowStartOffset(min, max),
    );
  });

  it("rejects client dates beyond max with a clear message", () => {
    vi.stubEnv("NEXT_PUBLIC_BOOKING_EXTENDED_WINDOW_ENABLED", "true");
    const max = maxBookableDateString(now, process.env, { client: true });
    const message = resolveScheduleDateTimeValidationMessage(
      addDaysToDateString(max, 1),
      now,
      process.env,
      { client: true },
    );
    expect(message).toMatch(/within the next 90 days/i);
  });

  it("flags dates outside immediate assignment window for deferred hint", () => {
    expect(
      isOutsideImmediateAssignmentWindow("2026-06-10", "10:00", 14, now),
    ).toBe(true);
    expect(
      isOutsideImmediateAssignmentWindow("2026-05-20", "10:00", 14, now),
    ).toBe(false);
  });

  it("uses Africa/Johannesburg calendar date at local midnight boundary", () => {
    vi.setSystemTime(new Date("2026-05-18T23:30:00+02:00"));
    expect(minBookableDateString()).toBe("2026-05-18");
    vi.setSystemTime(new Date("2026-05-19T00:30:00+02:00"));
    expect(minBookableDateString()).toBe("2026-05-19");
  });
});
