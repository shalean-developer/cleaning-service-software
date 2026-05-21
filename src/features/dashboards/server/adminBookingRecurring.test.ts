import { describe, expect, it } from "vitest";
import {
  computeRecurringActiveCount,
  isRecurringAdminBooking,
  isSeriesLinkedAdminBooking,
} from "./adminBookingRecurring";

describe("adminBookingRecurring", () => {
  it("counts only series-linked bookings as recurring for admin", () => {
    expect(isSeriesLinkedAdminBooking(null)).toBe(false);
    expect(isSeriesLinkedAdminBooking(undefined)).toBe(false);
    expect(isSeriesLinkedAdminBooking("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("does not treat metadata weekly cadence as recurring", () => {
    expect(
      isRecurringAdminBooking({
        seriesId: null,
        metadata: {
          quote: { input: { frequency: "weekly" } },
        },
      }),
    ).toBe(false);
    expect(
      isRecurringAdminBooking({
        seriesId: "550e8400-e29b-41d4-a716-446655440000",
        metadata: { quote: { input: { frequency: "once" } } },
      }),
    ).toBe(true);
  });

  it("returns zero recurring active when no series engine rows exist", () => {
    expect(computeRecurringActiveCount(null)).toBe(0);
    expect(computeRecurringActiveCount(0)).toBe(0);
    expect(computeRecurringActiveCount(3)).toBe(3);
  });

  it("metadata-only weekly bookings are not recurring admin flags", () => {
    expect(
      isRecurringAdminBooking({
        seriesId: null,
        metadata: { quote: { input: { frequency: "weekly" } } },
      }),
    ).toBe(false);
  });
});
