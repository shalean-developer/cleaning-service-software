import { describe, expect, it } from "vitest";
import {
  customerBookingMatchesFilterTab,
  emptyStateForCustomerBookingTab,
  filterCustomerBookingsForTab,
} from "./customerBookingsDashboardDisplay";
import type { CustomerBookingListItem } from "./server/types";

function item(
  overrides: Partial<CustomerBookingListItem> & Pick<CustomerBookingListItem, "status" | "isUpcoming">,
): CustomerBookingListItem {
  return {
    id: "id-1",
    paymentStatus: null,
    paymentFailureReason: null,
    scheduledStart: "",
    scheduledEnd: "",
    priceCents: 0,
    currency: "ZAR",
    display: {
      serviceSlug: null,
      serviceLabel: "Test",
      suburb: null,
      city: null,
      addressLine: null,
      locationSummary: "Cape Town",
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
    },
    scheduleLabel: "Mon 9:00",
    assignedCleanerLabel: null,
    deferredAssignmentMessage: null,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("customerBookingsDashboardDisplay", () => {
  it("filters upcoming via isUpcoming", () => {
    const bookings = [
      item({ id: "a", status: "assigned", isUpcoming: true }),
      item({ id: "b", status: "completed", isUpcoming: false }),
    ];
    expect(filterCustomerBookingsForTab(bookings, "upcoming").map((b) => b.id)).toEqual(["a"]);
  });

  it("filters completed terminal statuses", () => {
    expect(customerBookingMatchesFilterTab({ status: "payout_ready", isUpcoming: false }, "completed")).toBe(
      true,
    );
    expect(customerBookingMatchesFilterTab({ status: "paid_out", isUpcoming: false }, "completed")).toBe(true);
    expect(customerBookingMatchesFilterTab({ status: "assigned", isUpcoming: true }, "completed")).toBe(false);
  });

  it("filters unpaid payment states", () => {
    expect(customerBookingMatchesFilterTab({ status: "pending_payment", isUpcoming: false }, "unpaid")).toBe(
      true,
    );
    expect(customerBookingMatchesFilterTab({ status: "payment_failed", isUpcoming: false }, "unpaid")).toBe(
      true,
    );
    expect(customerBookingMatchesFilterTab({ status: "confirmed", isUpcoming: true }, "unpaid")).toBe(false);
  });

  it("provides tab-specific empty copy", () => {
    expect(emptyStateForCustomerBookingTab("unpaid").title).toBe("No unpaid bookings");
    expect(emptyStateForCustomerBookingTab("unpaid").description).toContain("caught up");
  });
});
