import { describe, expect, it } from "vitest";
import {
  addDaysToDateString,
  buildScheduleDateOptions,
  formatTimeSlotLabel,
  resolveScheduleTimeSlots,
  SCHEDULE_DATE_OPTION_COUNT,
  SCHEDULE_TIME_PRESETS,
} from "./scheduleStepDisplay";

describe("scheduleStepDisplay", () => {
  it("builds exactly 7 weekday-labelled date options from minDate", () => {
    const options = buildScheduleDateOptions("2026-05-18");
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

  it("formats time slots for display", () => {
    expect(formatTimeSlotLabel("09:00")).toMatch(/9/);
  });

  it("includes a non-preset selected time in the slot list", () => {
    expect(resolveScheduleTimeSlots("07:30")).toContain("07:30");
    expect(resolveScheduleTimeSlots("09:00")).toEqual([...SCHEDULE_TIME_PRESETS]);
  });
});
