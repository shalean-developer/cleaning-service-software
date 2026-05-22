import { describe, expect, it } from "vitest";
import {
  addDaysToDateString,
  buildScheduleDateOptions,
  formatTimeSlotLabel,
  resolveAdjacentScheduleDateValue,
  resolveScheduleDateArrowNavigationState,
  resolveScheduleDateScrollButtonsState,
  resolveScheduleDateScrollStepPx,
  resolveScheduleTimeSlots,
  scheduleDateScrollerHasOverflow,
  SCHEDULE_DATE_OPTION_COUNT,
  SCHEDULE_TIME_PRESETS,
} from "./scheduleStepDisplay";

describe("scheduleStepDisplay", () => {
  it("builds exactly 7 weekday-labelled date options from minDate", () => {
    const options = buildScheduleDateOptions("2026-05-18", 0, "2026-08-16");
    expect(options).toHaveLength(SCHEDULE_DATE_OPTION_COUNT);
    expect(options[0]).toMatchObject({
      value: "2026-05-18",
      disabled: false,
    });
    expect(options[6].value).toBe("2026-05-24");

    for (const option of options) {
      expect(option.dayLabel).toMatch(/^[A-Z]{3}$/);
      expect(option.dayLabel).not.toBe("TODAY");
      expect(option.dayLabel).not.toBe("TOMORROW");
      expect(option.dateLabel).toMatch(/\d{1,2} [A-Za-z]{3}/);
    }
  });

  it("adds days without shifting the calendar month incorrectly", () => {
    expect(addDaysToDateString("2026-05-30", 2)).toBe("2026-06-01");
  });

  it("defines 30-minute arrival slots from 7:00 am through 2:00 pm with no duplicates", () => {
    expect(SCHEDULE_TIME_PRESETS).toEqual([
      "07:00",
      "07:30",
      "08:00",
      "08:30",
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "14:00",
    ]);
    expect(new Set(SCHEDULE_TIME_PRESETS).size).toBe(SCHEDULE_TIME_PRESETS.length);
  });

  it("formats time slots for display in 12-hour am/pm", () => {
    expect(formatTimeSlotLabel("07:00")).toMatch(/7:00\s*am/i);
    expect(formatTimeSlotLabel("09:00")).toMatch(/9:00\s*am/i);
    expect(formatTimeSlotLabel("12:00")).toMatch(/12:00\s*pm/i);
    expect(formatTimeSlotLabel("13:30")).toMatch(/1:30\s*pm/i);
    expect(formatTimeSlotLabel("14:00")).toMatch(/2:00\s*pm/i);
  });

  it("includes a non-preset selected time in the slot list", () => {
    const legacySlot = resolveScheduleTimeSlots("07:15");
    expect(legacySlot).toHaveLength(SCHEDULE_TIME_PRESETS.length + 1);
    expect(legacySlot).toContain("07:15");
    expect(resolveScheduleTimeSlots("09:00")).toEqual([...SCHEDULE_TIME_PRESETS]);
    expect(resolveScheduleTimeSlots("17:00")).toContain("17:00");
  });

  it("detects horizontal overflow for the date scroller", () => {
    expect(scheduleDateScrollerHasOverflow(400, 300)).toBe(true);
    expect(scheduleDateScrollerHasOverflow(300, 300)).toBe(false);
  });

  it("derives scroll arrow disabled state from scroll metrics", () => {
    expect(
      resolveScheduleDateScrollButtonsState(0, 400, 300),
    ).toEqual({ canScrollLeft: false, canScrollRight: true });

    expect(
      resolveScheduleDateScrollButtonsState(100, 400, 300),
    ).toEqual({ canScrollLeft: true, canScrollRight: false });
  });

  it("disables date cards beyond maxDate in a paginated window", () => {
    const options = buildScheduleDateOptions("2026-05-18", 84, "2026-08-16");
    expect(options.some((option) => option.value === "2026-08-16" && !option.disabled)).toBe(
      true,
    );
    expect(options.every((option) => option.value <= "2026-08-16")).toBe(true);
  });

  it("resolves adjacent enabled dates for non-overflow navigation", () => {
    const options = buildScheduleDateOptions("2026-05-18", 0, "2026-08-16");

    expect(resolveScheduleDateArrowNavigationState(options, "2026-05-18")).toEqual({
      canGoPrevious: false,
      canGoNext: true,
    });
    expect(resolveScheduleDateArrowNavigationState(options, "2026-05-24")).toEqual({
      canGoPrevious: true,
      canGoNext: false,
    });
    expect(
      resolveAdjacentScheduleDateValue(options, "2026-05-18", 1),
    ).toBe("2026-05-19");
    expect(
      resolveAdjacentScheduleDateValue(options, "2026-05-24", -1),
    ).toBe("2026-05-23");
    expect(
      resolveAdjacentScheduleDateValue(options, "2026-05-18", -1),
    ).toBeNull();
  });

  it("computes scroll step from card width", () => {
    expect(resolveScheduleDateScrollStepPx(68)).toBe(74);
    expect(resolveScheduleDateScrollStepPx(0)).toBe(72);
  });
});
