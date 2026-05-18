import { describe, expect, it } from "vitest";
import {
  aggregateAssignmentMetricsHourly,
  computeAcceptRatePercent,
  computeTerminalOfferCount,
} from "./assignmentMetricsAggregate";

const bucketStart = new Date("2026-05-18T10:00:00.000Z");
const bucketEnd = new Date("2026-05-18T11:00:00.000Z");

describe("assignmentMetricsAggregate (7B-1a)", () => {
  it("counts offers created and terminal outcomes in bucket", () => {
    const counters = aggregateAssignmentMetricsHourly(
      bucketStart,
      bucketEnd,
      [
        {
          booking_id: "b1",
          status: "offered",
          offered_at: "2026-05-18T10:15:00.000Z",
          responded_at: null,
          updated_at: "2026-05-18T10:15:00.000Z",
        },
      ],
      [],
      [
        {
          booking_id: "b1",
          status: "accepted",
          offered_at: "2026-05-18T10:15:00.000Z",
          responded_at: "2026-05-18T10:30:00.000Z",
          updated_at: "2026-05-18T10:30:00.000Z",
        },
        {
          booking_id: "b2",
          status: "declined",
          offered_at: "2026-05-18T09:00:00.000Z",
          responded_at: "2026-05-18T10:45:00.000Z",
          updated_at: "2026-05-18T10:45:00.000Z",
        },
      ],
      ["b1"],
      2,
    );

    expect(counters.offers_created_count).toBe(1);
    expect(counters.offers_accepted_count).toBe(1);
    expect(counters.offers_declined_count).toBe(1);
    expect(counters.bookings_assigned_count).toBe(1);
    expect(counters.admin_intervention_count).toBe(2);
    expect(computeAcceptRatePercent(counters)).toBe(50);
    expect(computeTerminalOfferCount(counters)).toBe(2);
  });

  it("counts redispatch when a prior offer exists for the booking", () => {
    const created = [
      {
        booking_id: "b1",
        status: "offered" as const,
        offered_at: "2026-05-18T10:20:00.000Z",
        responded_at: null,
        updated_at: "2026-05-18T10:20:00.000Z",
      },
    ];
    const history = [
      {
        booking_id: "b1",
        status: "declined" as const,
        offered_at: "2026-05-18T10:05:00.000Z",
        responded_at: "2026-05-18T10:10:00.000Z",
        updated_at: "2026-05-18T10:10:00.000Z",
      },
      ...created,
    ];

    const counters = aggregateAssignmentMetricsHourly(
      bucketStart,
      bucketEnd,
      created,
      history,
      [],
      [],
      0,
    );

    expect(counters.redispatch_booking_count).toBe(1);
  });

  it("counts max attempts when the fifth offer is created in bucket", () => {
    const history = Array.from({ length: 4 }, (_, i) => ({
      booking_id: "b1",
      status: "declined" as const,
      offered_at: `2026-05-18T0${i}:00:00.000Z`,
      responded_at: `2026-05-18T0${i}:05:00.000Z`,
      updated_at: `2026-05-18T0${i}:05:00.000Z`,
    }));
    const created = [
      {
        booking_id: "b1",
        status: "offered" as const,
        offered_at: "2026-05-18T10:30:00.000Z",
        responded_at: null,
        updated_at: "2026-05-18T10:30:00.000Z",
      },
    ];

    const counters = aggregateAssignmentMetricsHourly(
      bucketStart,
      bucketEnd,
      created,
      [...history, ...created],
      [],
      [],
      0,
    );

    expect(counters.max_attempts_booking_count).toBe(1);
  });
});
