import { describe, expect, it } from "vitest";
import {
  isScheduledOnJohannesburgDay,
  johannesburgCalendarDayKey,
  johannesburgDayUtcBounds,
} from "./johannesburgDay";

describe("johannesburgDay", () => {
  it("bounds a Johannesburg calendar day in UTC", () => {
    const { startIso, endExclusiveIso } = johannesburgDayUtcBounds("2026-05-21");
    expect(startIso).toBe("2026-05-20T22:00:00.000Z");
    expect(endExclusiveIso).toBe("2026-05-21T22:00:00.000Z");
  });

  it("matches scheduled_start to Johannesburg day key", () => {
    const dayKey = "2026-05-21";
    expect(isScheduledOnJohannesburgDay("2026-05-21T08:00:00+02:00", dayKey)).toBe(true);
    expect(isScheduledOnJohannesburgDay("2026-05-20T23:30:00+02:00", dayKey)).toBe(false);
  });

  it("derives today key from reference instant", () => {
    const key = johannesburgCalendarDayKey(new Date("2026-05-21T10:00:00+02:00"));
    expect(key).toBe("2026-05-21");
  });

  it("includes 00:30 SAST on the same calendar day", () => {
    const dayKey = "2026-05-21";
    const { startIso, endExclusiveIso } = johannesburgDayUtcBounds(dayKey);
    const at0030Ms = new Date("2026-05-21T00:30:00+02:00").getTime();
    expect(at0030Ms >= new Date(startIso).getTime()).toBe(true);
    expect(at0030Ms < new Date(endExclusiveIso).getTime()).toBe(true);
    expect(isScheduledOnJohannesburgDay("2026-05-21T00:30:00+02:00", dayKey)).toBe(true);
  });

  it("includes 23:30 SAST on the same calendar day", () => {
    const dayKey = "2026-05-21";
    const { startIso, endExclusiveIso } = johannesburgDayUtcBounds(dayKey);
    const at2330Ms = new Date("2026-05-21T23:30:00+02:00").getTime();
    expect(at2330Ms >= new Date(startIso).getTime()).toBe(true);
    expect(at2330Ms < new Date(endExclusiveIso).getTime()).toBe(true);
    expect(isScheduledOnJohannesburgDay("2026-05-21T23:30:00+02:00", dayKey)).toBe(true);
  });

  it("excludes tomorrow booking from today bounds", () => {
    const dayKey = "2026-05-21";
    const { endExclusiveIso } = johannesburgDayUtcBounds(dayKey);
    const tomorrowMs = new Date("2026-05-22T08:00:00+02:00").getTime();
    expect(tomorrowMs >= new Date(endExclusiveIso).getTime()).toBe(true);
    expect(isScheduledOnJohannesburgDay("2026-05-22T08:00:00+02:00", dayKey)).toBe(false);
  });

  it("excludes yesterday booking from today bounds", () => {
    const dayKey = "2026-05-21";
    const { startIso } = johannesburgDayUtcBounds(dayKey);
    const yesterdayMs = new Date("2026-05-20T23:30:00+02:00").getTime();
    expect(yesterdayMs < new Date(startIso).getTime()).toBe(true);
    expect(isScheduledOnJohannesburgDay("2026-05-20T23:30:00+02:00", dayKey)).toBe(false);
  });
});
