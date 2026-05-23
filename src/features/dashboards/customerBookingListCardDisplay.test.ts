import { describe, expect, it } from "vitest";
import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
} from "@/features/bookings/server/paymentFailureDisplay";
import { customerBookingListCardLayers } from "./customerBookingListCardDisplay";

const baseDisplay = {
  serviceSlug: null as string | null,
  assignmentCustomerMessage: null as string | null,
  isTwoCleanerRequest: false,
  teamSupportLabel: null as string | null,
};

describe("customerBookingListCardLayers", () => {
  it("uses a single dominant booking badge for payment_failed", () => {
    const layers = customerBookingListCardLayers({
      status: "payment_failed",
      paymentStatus: "failed",
      paymentFailureReason: null,
      isUpcoming: false,
      display: baseDisplay,
      assignedCleanerLabel: null,
    });

    expect(layers.dominantBadge).toEqual({
      label: "Payment not completed",
      tone: "danger",
    });
    expect(layers.paymentStatusLine).toBeNull();
    expect(layers.supportingMessage).toBeNull();
    expect(layers.ctaLabel).toBe("Complete payment");
  });

  it("uses Complete payment CTA for pending_payment bookings", () => {
    const layers = customerBookingListCardLayers({
      status: "pending_payment",
      paymentStatus: "pending",
      paymentFailureReason: null,
      isUpcoming: false,
      display: baseDisplay,
      assignedCleanerLabel: null,
    });

    expect(layers.ctaLabel).toBe("Complete payment");
  });

  it("uses checkout expired on the dominant badge only", () => {
    const layers = customerBookingListCardLayers({
      status: "payment_failed",
      paymentStatus: "failed",
      paymentFailureReason: CHECKOUT_EXPIRED_FAILURE_REASON,
      isUpcoming: false,
      display: baseDisplay,
      assignedCleanerLabel: null,
    });

    expect(layers.dominantBadge.label).toBe("Checkout not completed");
    expect(layers.paymentStatusLine).toBeNull();
    expect(layers.supportingMessage).toBeNull();
  });

  it("uses Airbnb turnover list copy when service is airbnb-cleaning", () => {
    const layers = customerBookingListCardLayers({
      status: "pending_assignment",
      paymentStatus: "paid",
      paymentFailureReason: null,
      isUpcoming: true,
      display: { ...baseDisplay, serviceSlug: "airbnb-cleaning" },
      assignedCleanerLabel: null,
    });

    expect(layers.dominantBadge.label).toBe("Finding your cleaner");
    expect(layers.serviceSubtitle).toBe("Guest-ready preparation scheduled");
    expect(layers.ctaLabel).toBe("View turnover");
  });

  it("shows team support status when requested and no assignment message", () => {
    const layers = customerBookingListCardLayers({
      status: "confirmed",
      paymentStatus: "paid",
      paymentFailureReason: null,
      isUpcoming: true,
      display: {
        serviceSlug: null,
        assignmentCustomerMessage: null,
        isTwoCleanerRequest: true,
        teamSupportLabel: "Team support requested. awaiting confirmation",
      },
      assignedCleanerLabel: null,
    });

    expect(layers.supportingMessage).toEqual({
      kind: "assignment",
      text: "Team support requested. awaiting confirmation",
    });
  });

  it("prefers assignment message over assignment warning badge and cleaner line", () => {
    const layers = customerBookingListCardLayers({
      status: "pending_assignment",
      paymentStatus: "paid",
      paymentFailureReason: null,
      isUpcoming: true,
      display: {
        serviceSlug: null,
        assignmentCustomerMessage: "We're finding another available cleaner.",
        isTwoCleanerRequest: false,
        teamSupportLabel: null,
      },
      assignedCleanerLabel: null,
    });

    expect(layers.dominantBadge.label).toBe("Finding your cleaner");
    expect(layers.paymentStatusLine).toBeNull();
    expect(layers.supportingMessage).toBeNull();
  });

  it("shows assigned cleaner as supporting line when no assignment message", () => {
    const layers = customerBookingListCardLayers({
      status: "assigned",
      paymentStatus: "paid",
      paymentFailureReason: null,
      isUpcoming: true,
      display: baseDisplay,
      assignedCleanerLabel: "Cleaner assigned",
    });

    expect(layers.dominantBadge.label).toBe("Cleaner assigned");
    expect(layers.paymentStatusLine).toBeNull();
    expect(layers.supportingMessage).toEqual({
      kind: "cleaner",
      text: "Cleaner assigned",
    });
  });

  it("omits redundant payment line on completed bookings", () => {
    const layers = customerBookingListCardLayers({
      status: "completed",
      paymentStatus: "paid",
      paymentFailureReason: null,
      isUpcoming: false,
      display: baseDisplay,
      assignedCleanerLabel: "Cleaner assigned",
    });

    expect(layers.dominantBadge.label).toBe("Completed");
    expect(layers.paymentStatusLine).toBeNull();
    expect(layers.supportingMessage).toEqual({
      kind: "cleaner",
      text: "Cleaner assigned",
    });
  });

  it("maps payout terminal statuses to Completed without payment line", () => {
    const layers = customerBookingListCardLayers({
      status: "payout_ready",
      paymentStatus: "paid",
      paymentFailureReason: null,
      isUpcoming: false,
      display: baseDisplay,
      assignedCleanerLabel: null,
    });

    expect(layers.dominantBadge.label).toBe("Completed");
    expect(layers.paymentStatusLine).toBeNull();
  });
});
