import { describe, expect, it } from "vitest";
import {
  customerHomeGreetingLabel,
  customerHomeGreetingPeriod,
  customerHomeHeroCopy,
  customerHomeLifecycleSteps,
  customerHomeSummaryStats,
  formatUpcomingScheduleShort,
  pickFeaturedUpcomingBooking,
} from "./customerHomeDisplay";
import type { CustomerBookingListItem } from "./server/types";

function item(
  overrides: Partial<CustomerBookingListItem> & Pick<CustomerBookingListItem, "status" | "isUpcoming">,
): CustomerBookingListItem {
  return {
    id: overrides.id ?? "b-1",
    paymentStatus: null,
    paymentFailureReason: null,
    scheduledStart: overrides.scheduledStart ?? "2026-05-21T07:00:00.000Z",
    scheduledEnd: overrides.scheduledEnd ?? "2026-05-21T10:00:00.000Z",
    priceCents: 12000,
    currency: "ZAR",
    seriesId: null,
    isSeriesVisit: false,
    display: {
      serviceSlug: "regular-cleaning",
      serviceLabel: "Regular Cleaning",
      suburb: "Claremont",
      city: "Cape Town",
      addressLine: null,
      locationSummary: "Claremont, Cape Town",
      homeSizeSummary: null,
      cleaningIntensityLabel: null,
      equipmentSupplyLabel: null,
      equipmentSupplyOperationalLabel: null,
      teamSupportLabel: null,
      teamSupportCleanerNote: null,
      isTwoCleanerRequest: false,
      teamRequestFulfillmentLabel: null,
      frequencyLabel: null,
      addonsSummary: null,
      cleanerPreferenceMode: null,
      preferredCleanerId: null,
      specialInstructions: null,
      contactPhone: null,
      contactPhoneDisplay: null,
      assignmentAttention: null,
      assignmentReason: null,
      assignmentVisibilityKey: null,
      assignmentCustomerMessage: null,
      showCustomerAssignmentWarning: false,
      ...overrides.display,
    },
    scheduleLabel: "Wed 21 May · 09:00 – 12:00",
    assignedCleanerLabel: overrides.assignedCleanerLabel ?? null,
    deferredAssignmentMessage: null,
    updatedAt: overrides.updatedAt ?? "2026-05-20T08:00:00.000Z",
    ...overrides,
  };
}

describe("customerHomeDisplay", () => {
  it("picks the nearest upcoming booking by scheduled start", () => {
    const bookings = [
      item({
        id: "later",
        status: "confirmed",
        isUpcoming: true,
        scheduledStart: "2026-05-25T07:00:00.000Z",
      }),
      item({
        id: "soon",
        status: "pending_assignment",
        isUpcoming: true,
        scheduledStart: "2026-05-21T07:00:00.000Z",
      }),
    ];
    expect(pickFeaturedUpcomingBooking(bookings)?.id).toBe("soon");
  });

  it("builds empty-state hero copy when there is no upcoming booking", () => {
    const copy = customerHomeHeroCopy({
      displayName: "Sam",
      featured: null,
    });
    expect(copy.title).toBe("Welcome back 👋");
    expect(copy.subtitle).toContain("no upcoming bookings");
  });

  it("maps pending assignment to the matching-cleaner lifecycle step", () => {
    const steps = customerHomeLifecycleSteps("pending_assignment");
    const current = steps.find((s) => s.state === "current");
    expect(current?.label).toBe("Matching cleaner");
    expect(steps.filter((s) => s.state === "complete").length).toBe(2);
  });

  it("aggregates summary stats from existing tab filters", () => {
    const stats = customerHomeSummaryStats([
      item({ status: "confirmed", isUpcoming: true }),
      item({ status: "completed", isUpcoming: false }),
      item({ status: "pending_payment", isUpcoming: false }),
    ]);
    expect(stats.upcoming).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.pendingPayments).toBe(1);
    expect(stats.savedArea).toBe("Claremont, Cape Town");
  });

  it("uses morning greeting before noon in Johannesburg", () => {
    const at = new Date("2026-05-20T06:00:00.000Z");
    expect(customerHomeGreetingPeriod(at)).toBe("morning");
    expect(customerHomeGreetingLabel("morning")).toBe("Good morning");
  });

  it("formats tomorrow schedule copy for the hero", () => {
    const at = new Date("2026-05-20T08:00:00.000Z");
    const label = formatUpcomingScheduleShort(
      "2026-05-21T07:00:00.000Z",
      "2026-05-21T10:00:00.000Z",
      at,
    );
    expect(label).toContain("tomorrow");
    expect(label).toContain("at");
  });
});
