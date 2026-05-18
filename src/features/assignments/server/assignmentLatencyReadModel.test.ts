import { describe, expect, it } from "vitest";
import type { OfferMetricsInput } from "./assignmentMetricsAggregate";
import { computeAssignmentLatency24h } from "./assignmentLatencyReadModel";

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

describe("assignmentLatencyReadModel (7B-1c-min)", () => {
  it("builds all three latency metrics from golden fixture", () => {
    const pending = new Map([
      ["fast", "2026-05-18T08:00:00.000Z"],
      ["slow", "2026-05-18T06:00:00.000Z"],
    ]);

    const terminalOffers: OfferMetricsInput[] = [];
    const allOffers: OfferMetricsInput[] = [];
    const acceptAudits: { booking_id: string; created_at: string }[] = [];

    for (let i = 0; i < 10; i += 1) {
      const bookingId = `first-offer-${i}`;
      const offeredAt = `2026-05-18T10:${String(i).padStart(2, "0")}:00.000Z`;
      const respondedAt = `2026-05-18T10:${String(i + 15).padStart(2, "0")}:00.000Z`;
      pending.set(bookingId, `2026-05-18T09:00:00.000Z`);

      terminalOffers.push(
        offer({
          booking_id: bookingId,
          status: i % 2 === 0 ? "accepted" : "declined",
          offered_at: offeredAt,
          responded_at: respondedAt,
        }),
      );
      allOffers.push(
        offer({
          booking_id: bookingId,
          status: "accepted",
          offered_at: offeredAt,
        }),
      );
    }

    for (let i = 0; i < 10; i += 1) {
      const bookingId = `assigned-${i}`;
      pending.set(bookingId, `2026-05-18T0${6 + (i % 4)}:00:00.000Z`);
      acceptAudits.push({
        booking_id: bookingId,
        created_at: `2026-05-18T1${i % 2}:30:00.000Z`,
      });
    }

    const latency = computeAssignmentLatency24h({
      terminalOffers,
      allOffersForFirstOffer: allOffers,
      acceptAudits,
      pendingByBookingId: pending,
      bucketStart,
      bucketEnd,
    });

    expect(latency.cleanerResponseTime.status).toBe("ok");
    expect(latency.cleanerResponseTime.sampleSize).toBe(10);
    expect(latency.timeToFirstOffer.status).toBe("ok");
    expect(latency.timeToAssigned.status).toBe("ok");
  });
});
