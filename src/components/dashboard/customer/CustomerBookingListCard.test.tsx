import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE } from "@/features/assignments/server/deferredDispatchStatus";
import type { CustomerBookingListItem } from "@/features/dashboards/server/types";
import { CustomerBookingListCard } from "./CustomerBookingListCard";

function minimalBooking(
  overrides: Partial<CustomerBookingListItem> = {},
): CustomerBookingListItem {
  return {
    id: "b1",
    status: "confirmed",
    paymentStatus: "paid",
    paymentFailureReason: null,
    isUpcoming: true,
    scheduledStart: "",
    scheduledEnd: "",
    priceCents: 47700,
    currency: "ZAR",
    display: {
      serviceSlug: "regular-cleaning",
      serviceLabel: "Regular cleaning",
      suburb: "Sea Point",
      city: "Cape Town",
      addressLine: null,
      locationSummary: "Sea Point, Cape Town",
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
    scheduleLabel: "Mon 9 Jun · 09:00",
    assignedCleanerLabel: null,
    deferredAssignmentMessage: null,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("CustomerBookingListCard", () => {
  it("renders service, schedule, price, status, and view-details CTA", () => {
    const html = renderToStaticMarkup(<CustomerBookingListCard booking={minimalBooking()} />);

    expect(html).toContain("Regular cleaning");
    expect(html).toContain("Mon 9 Jun · 09:00");
    expect(html).toContain("Sea Point, Cape Town");
    expect(html).toMatch(/477/);
    expect(html).toContain("View details");
    expect(html).toContain("/customer/bookings/b1");
  });

  it("shows payment incomplete helper for payment_failed bookings", () => {
    const html = renderToStaticMarkup(
      <CustomerBookingListCard
        booking={minimalBooking({ status: "payment_failed", paymentStatus: "failed" })}
      />,
    );

    expect(html).toContain("Payment not completed");
    expect(html).not.toContain("open booking to pay");
    expect(html).toContain("Complete payment");
  });

  it("shows deferred assignment message when present", () => {
    const html = renderToStaticMarkup(
      <CustomerBookingListCard
        booking={minimalBooking({
          deferredAssignmentMessage: DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE,
        })}
      />,
    );

    expect(html).toContain("assign your cleaner closer to the service date");
  });

  it("shows team support copy when requested", () => {
    const html = renderToStaticMarkup(
      <CustomerBookingListCard
        booking={minimalBooking({
          display: {
            ...minimalBooking().display,
            isTwoCleanerRequest: true,
            teamSupportLabel: "Team support requested. awaiting confirmation",
          },
        })}
      />,
    );

    expect(html).toContain("Team support requested. awaiting confirmation");
  });
});
