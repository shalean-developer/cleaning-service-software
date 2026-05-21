import { describe, expect, it } from "vitest";
import {
  computeMonthlyNextOccurrence,
  computeNextOccurrenceAfter,
  johannesburgWallClockToIso,
} from "./recurrenceDateEngine";

describe("recurrenceDateEngine", () => {
  it("advances weekly by 7 days", () => {
    const anchor = "2026-01-15T08:00:00+02:00";
    const next = computeNextOccurrenceAfter("weekly", anchor);
    expect(next).toBe(new Date(new Date(anchor).getTime() + 7 * 86_400_000).toISOString());
  });

  it("advances biweekly by 14 days", () => {
    const anchor = "2026-01-15T08:00:00+02:00";
    const next = computeNextOccurrenceAfter("biweekly", anchor);
    expect(next).toBe(new Date(new Date(anchor).getTime() + 14 * 86_400_000).toISOString());
  });

  it("monthly from Jan 31 clamps to Feb 28 in non-leap year", () => {
    const anchor = "2025-01-31T09:30:00+02:00";
    const next = computeMonthlyNextOccurrence(anchor);
    expect(next).toContain("2025-02-28");
    expect(new Date(next).getTime()).toBeGreaterThan(new Date(anchor).getTime());
  });

  it("monthly from Jan 31 clamps to Feb 29 in leap year", () => {
    const anchor = "2024-01-31T09:30:00+02:00";
    const next = computeMonthlyNextOccurrence(anchor);
    expect(next).toContain("2024-02-29");
  });

  it("monthly preserves day-of-month when valid", () => {
    const anchor = "2026-03-15T14:00:00+02:00";
    const next = computeMonthlyNextOccurrence(anchor);
    expect(next).toContain("2026-04-15");
    expect(new Date(next).getUTCHours()).toBe(12);
  });

  it("SAST midnight boundary uses +02:00 wall clock", () => {
    const iso = johannesburgWallClockToIso({
      year: 2026,
      month: 5,
      day: 21,
      hour: 0,
      minute: 0,
      second: 0,
    });
    expect(iso).toBe("2026-05-20T22:00:00.000Z");
  });
});
