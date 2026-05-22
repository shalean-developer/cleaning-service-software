import { describe, expect, it } from "vitest";
import {
  customerHubHeroCopy,
  customerHubRecentStays,
  customerHubVisitStatusSteps,
  formatHubVisitScheduleLine,
  pickAlsoScheduledUpcoming,
} from "./customerHubDisplay";
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

describe("customerHubDisplay", () => {
  it("builds hub hero copy with display name", () => {
    const copy = customerHubHeroCopy({ displayName: "Alex", hasUpcoming: true });
    expect(copy.title).toBe("Welcome back, Alex");
    expect(copy.eyebrow).toBe("HOME CARE");
  });

  it("picks the second upcoming visit for also scheduled", () => {
    const bookings = [
      item({
        id: "first",
        status: "confirmed",
        isUpcoming: true,
        scheduledStart: "2026-05-21T07:00:00.000Z",
      }),
      item({
        id: "second",
        status: "assigned",
        isUpcoming: true,
        scheduledStart: "2026-05-22T07:00:00.000Z",
      }),
    ];
    expect(pickAlsoScheduledUpcoming(bookings, "first")?.id).toBe("second");
  });

  it("maps assigned status to arrival locked step", () => {
    const steps = customerHubVisitStatusSteps("assigned");
    const current = steps.find((s) => s.state === "current");
    expect(current?.label).toBe("Arrival locked");
  });

  it("lists completed bookings as recent stays", () => {
    const stays = customerHubRecentStays([
      item({ status: "confirmed", isUpcoming: true }),
      item({ status: "completed", isUpcoming: false, id: "done" }),
    ]);
    expect(stays).toHaveLength(1);
    expect(stays[0]?.id).toBe("done");
  });

  it("formats schedule line with suburb", () => {
    const line = formatHubVisitScheduleLine(
      item({ status: "confirmed", isUpcoming: true }),
    );
    expect(line).toContain("Claremont");
  });
});
