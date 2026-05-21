import { describe, expect, it } from "vitest";
import { readSeriesFrequencyFromBookingMetadata } from "./readBookingCadence";
import { computeNextOccurrenceAfter } from "./recurrenceDateEngine";

describe("materializeRecurringSeriesFromBooking (cadence inputs)", () => {
  it("maps weekly metadata to series frequency", () => {
    expect(
      readSeriesFrequencyFromBookingMetadata({
        quote: { input: { frequency: "weekly", serviceSlug: "regular-cleaning" } },
      }),
    ).toBe("weekly");
  });

  it("maps biweekly and monthly metadata", () => {
    expect(
      readSeriesFrequencyFromBookingMetadata({
        quote: { input: { frequency: "biweekly" } },
      }),
    ).toBe("biweekly");
    expect(
      readSeriesFrequencyFromBookingMetadata({
        quote: { input: { frequency: "monthly" } },
      }),
    ).toBe("monthly");
  });

  it("skips once-off metadata", () => {
    expect(
      readSeriesFrequencyFromBookingMetadata({
        quote: { input: { frequency: "once" } },
      }),
    ).toBeNull();
  });

  it("computes first next occurrence after anchor for each cadence", () => {
    const anchor = "2026-03-10T09:00:00+02:00";
    expect(computeNextOccurrenceAfter("weekly", anchor)).not.toBe(anchor);
    expect(computeNextOccurrenceAfter("biweekly", anchor)).not.toBe(anchor);
    expect(computeNextOccurrenceAfter("monthly", anchor)).toContain("2026-04");
  });
});
