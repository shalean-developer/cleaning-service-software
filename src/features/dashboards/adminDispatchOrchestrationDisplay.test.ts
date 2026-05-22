import { describe, expect, it } from "vitest";
import {
  buildDispatchOrchestrationJobCard,
  buildDispatchOrchestrationSummary,
  resolveDispatchLaneId,
  resolveDispatchLaneStatus,
} from "@/features/dashboards/adminDispatchOrchestrationDisplay";
import type { AdminBookingListItem } from "@/features/dashboards/server/types";

const BASE_BOOKING = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  status: "confirmed",
  paymentStatus: "paid",
  paymentFailureReason: "none",
  customerLabel: "Sara E.",
  cleanerLabel: "Tariro N.",
  serviceLabel: "Deep clean",
  scheduleLabel: "Today · 09:00",
  scheduledStart: "2026-05-22T07:00:00.000Z",
  scheduledEnd: "2026-05-22T10:00:00.000Z",
  suburb: "Sandton",
  city: "Johannesburg",
  addressLine: "12 Main Rd",
  priceLabel: "R 450",
  priceCents: 45000,
  observation: {
    isTwoCleanerRequest: false,
    operationalLoad: { level: "standard", signals: [] },
    teamRequestFulfillment: null,
    teamRequestFulfillmentLabel: null,
    teamSupportOps: {
      coordinationStatus: null,
      teamSupportNotes: null,
      supportingCleaner: null,
    },
    supportingCleanerLabel: null,
    coordinationStatusLabel: null,
    hasTeamSupportNotes: false,
  },
  assignmentAttention: null,
  assignmentVisibilityKey: undefined,
  dispatchNotStarted: false,
  recoveryEligible: false,
  updatedAt: "2026-05-22T08:00:00.000Z",
} satisfies AdminBookingListItem;

describe("adminDispatchOrchestrationDisplay", () => {
  it("maps confirmed booking with cleaner to matched lane status", () => {
    expect(resolveDispatchLaneStatus(BASE_BOOKING)).toBe("matched");
    const card = buildDispatchOrchestrationJobCard(BASE_BOOKING);
    expect(card.laneStatus).toBe("matched");
    expect(card.statusLabel).toBe("Matched");
    expect(card.bookingRef).toMatch(/^SHL-/);
  });

  it("assigns morning lane for 09:00 SAST start", () => {
    expect(resolveDispatchLaneId(BASE_BOOKING.scheduledStart)).toBe("morning");
  });

  it("builds summary from today counts and queues", () => {
    const summary = buildDispatchOrchestrationSummary({
      today: {
        bookingsToday: 7,
        bookingsConfirmed: 5,
        bookingsDone: 0,
        cleanersActive: 3,
        revenueTodayCents: 0,
      },
      queues: [
        {
          key: "needs_assignment",
          label: "Needs assignment",
          count: 2,
          href: "/admin/bookings",
          tone: "warning",
        },
        {
          key: "assignment_attention",
          label: "Assignment attention",
          count: 1,
          href: "/admin/bookings",
          tone: "danger",
        },
      ],
      workQueueCount: 1,
      laneJobCount: 7,
    });

    expect(summary.confirmed).toBe(5);
    expect(summary.cleanersOnDuty).toBe(3);
    expect(summary.matching).toBe(2);
    expect(summary.slotsToday).toBe(7);
    expect(summary.pending).toBe(3);
  });
});
