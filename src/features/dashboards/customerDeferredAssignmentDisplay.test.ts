import { describe, expect, it } from "vitest";
import { DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE } from "@/features/assignments/server/deferredDispatchStatus";
import { customerBookingListCardLayers } from "./customerBookingListCardDisplay";
import { customerBookingStatusHero } from "./customerBookingDetailDisplay";
import type { CustomerBookingListItem } from "./server/types";

function minimalBooking(
  overrides: Partial<CustomerBookingListItem>,
): CustomerBookingListItem {
  return {
    id: "b1",
    status: "confirmed",
    paymentStatus: "paid",
    paymentFailureReason: null,
    isUpcoming: true,
    scheduledStart: new Date(Date.now() + 20 * 24 * 60 * 60_000).toISOString(),
    scheduledEnd: new Date(Date.now() + 21 * 24 * 60 * 60_000).toISOString(),
    priceCents: 1000,
    currency: "ZAR",
    display: {
      serviceSlug: "regular-cleaning",
      serviceLabel: "Regular cleaning",
      suburb: "Sea Point",
      city: "Cape Town",
      addressLine: null,
      locationSummary: "Sea Point",
      homeSizeSummary: null,
      cleaningIntensityLabel: null,
      equipmentSupplyLabel: null,
      equipmentSupplyOperationalLabel: null,
      frequencyLabel: null,
      addonsSummary: null,
      teamSupportLabel: null,
      teamSupportCleanerNote: null,
      isTwoCleanerRequest: false,
      teamRequestFulfillmentLabel: null,
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
    },
    scheduleLabel: "Mon 1 Jun",
    assignedCleanerLabel: null,
    deferredAssignmentMessage: DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("customer deferred assignment copy", () => {
  it("shows calm deferred message on list card, not failure copy", () => {
    const layers = customerBookingListCardLayers(minimalBooking({}));
    expect(layers.supportingMessage?.kind).toBe("assignment");
    expect(layers.supportingMessage?.text).toBe(DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE);
    expect(layers.dominantBadge.label).not.toMatch(/failed|attention/i);
  });

  it("overrides hero description for deferred confirmed bookings", () => {
    const hero = customerBookingStatusHero("confirmed", null, {
      deferredAssignmentMessage: DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE,
    });
    expect(hero.statusLine).toBe(DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE);
    expect(hero.statusLine).not.toMatch(/matching a cleaner/i);
  });
});
