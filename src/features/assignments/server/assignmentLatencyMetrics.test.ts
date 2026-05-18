import { describe, expect, it } from "vitest";
import type { OfferMetricsInput } from "./assignmentMetricsAggregate";
import {
  collectCleanerResponseDurationsMinutes,
  collectTimeToAssignedDurationsMinutes,
  collectTimeToFirstOfferDurationsMinutes,
  durationMinutesBetween,
  medianOfValues,
} from "./assignmentLatencyMetrics";

const bucketStart = new Date("2026-05-17T12:00:00.000Z");
const bucketEnd = new Date("2026-05-18T12:00:00.000Z");

function offer(partial: Partial<OfferMetricsInput> & Pick<OfferMetricsInput, "booking_id" | "status">): OfferMetricsInput {
  return {
    offered_at: "2026-05-18T10:00:00.000Z",
    responded_at: null,
    updated_at: "2026-05-18T10:00:00.000Z",
    ...partial,
  };
}

describe("assignmentLatencyMetrics (7B-1c-min)", () => {
  it("computes median for odd and even sample sizes", () => {
    expect(medianOfValues([])).toBeNull();
    expect(medianOfValues([30])).toBe(30);
    expect(medianOfValues([10, 20, 30])).toBe(20);
    expect(medianOfValues([10, 20, 30, 40])).toBe(25);
  });

  it("returns null for negative durations", () => {
    expect(
      durationMinutesBetween("2026-05-18T11:00:00.000Z", "2026-05-18T10:00:00.000Z"),
    ).toBeNull();
  });

  it("excludes expired, open, and cancelled offers from cleaner response", () => {
    const durations = collectCleanerResponseDurationsMinutes(
      [
        offer({
          booking_id: "b1",
          status: "accepted",
          offered_at: "2026-05-18T09:00:00.000Z",
          responded_at: "2026-05-18T09:30:00.000Z",
        }),
        offer({
          booking_id: "b2",
          status: "declined",
          offered_at: "2026-05-18T09:00:00.000Z",
          responded_at: "2026-05-18T10:00:00.000Z",
        }),
        offer({
          booking_id: "b3",
          status: "expired",
          offered_at: "2026-05-18T09:00:00.000Z",
          responded_at: null,
          updated_at: "2026-05-18T11:00:00.000Z",
        }),
        offer({
          booking_id: "b4",
          status: "cancelled",
          offered_at: "2026-05-18T09:00:00.000Z",
          responded_at: "2026-05-18T09:15:00.000Z",
        }),
        offer({
          booking_id: "b5",
          status: "offered",
          offered_at: "2026-05-18T09:00:00.000Z",
          responded_at: null,
        }),
      ],
      bucketStart,
      bucketEnd,
    );

    expect(durations).toEqual([30, 60]);
  });

  it("uses first offered_at for time-to-first-offer and excludes anomalies", () => {
    const pending = new Map([
      ["b1", "2026-05-18T08:00:00.000Z"],
      ["b2", "2026-05-18T09:00:00.000Z"],
    ]);

    const durations = collectTimeToFirstOfferDurationsMinutes(
      [
        offer({
          booking_id: "b1",
          status: "accepted",
          offered_at: "2026-05-18T10:00:00.000Z",
        }),
        offer({
          booking_id: "b1",
          status: "declined",
          offered_at: "2026-05-18T11:00:00.000Z",
        }),
        offer({
          booking_id: "b2",
          status: "accepted",
          offered_at: "2026-05-18T08:30:00.000Z",
        }),
      ],
      pending,
      bucketStart,
      bucketEnd,
    );

    expect(durations).toEqual([120]);
  });

  it("computes time-to-assigned from first pending and accept audit timestamps", () => {
    const pending = new Map([["b1", "2026-05-18T08:00:00.000Z"]]);

    const durations = collectTimeToAssignedDurationsMinutes(
      [
        { booking_id: "b1", created_at: "2026-05-18T10:00:00.000Z" },
        { booking_id: "b1", created_at: "2026-05-18T11:00:00.000Z" },
      ],
      pending,
    );

    expect(durations).toEqual([120]);
  });
});
