import { describe, expect, it } from "vitest";
import {
  daysUntilWeekday,
  formatSelectedDaysShort,
  normalizeSelectedDays,
  readSelectedDaysFromBookingMetadata,
  resolveSlotAnchorScheduledStart,
  shouldMaterializeScheduleGroup,
  weekdayFromJohannesburgInstant,
} from "./recurringScheduleDays";

describe("recurringScheduleDays", () => {
  it("normalizes and formats selected days", () => {
    expect(normalizeSelectedDays([3, 1, 1, 9])).toEqual([1, 3]);
    expect(formatSelectedDaysShort([1, 3, 5])).toBe("Mon · Wed · Fri");
  });

  it("reads selected days from booking metadata", () => {
    expect(
      readSelectedDaysFromBookingMetadata({
        recurringSchedule: { selectedDays: [2, 6] },
      }),
    ).toEqual([2, 6]);
  });

  it("detects multi-day group materialization", () => {
    expect(shouldMaterializeScheduleGroup("weekly", [1, 3])).toBe(true);
    expect(shouldMaterializeScheduleGroup("weekly", [1])).toBe(false);
    expect(shouldMaterializeScheduleGroup("monthly", [1, 3])).toBe(false);
  });

  it("computes slot anchors from paid visit", () => {
    const paid = "2026-06-01T09:00:00+02:00";
    expect(weekdayFromJohannesburgInstant(paid)).toBe(1);
    expect(daysUntilWeekday(1, 3)).toBe(2);
    const wed = resolveSlotAnchorScheduledStart(paid, 3);
    expect(new Date(wed).getTime()).toBeGreaterThan(new Date(paid).getTime());
  });
});
