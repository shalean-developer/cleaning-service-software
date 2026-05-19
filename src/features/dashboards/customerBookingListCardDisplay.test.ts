import { describe, expect, it } from "vitest";
import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
} from "@/features/bookings/server/paymentFailureDisplay";
import { customerBookingListCardLayers } from "./customerBookingListCardDisplay";

const baseDisplay = {
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
      display: baseDisplay,
      assignedCleanerLabel: null,
    });

    expect(layers.dominantBadge).toEqual({
      label: "Payment failed",
      tone: "danger",
    });
    expect(layers.paymentStatusLine).toEqual({
      text: "Payment incomplete — complete checkout to assign a cleaner.",
      tone: "attention",
    });
    expect(layers.supportingMessage).toBeNull();
  });

  it("uses checkout expired on the dominant badge only", () => {
    const layers = customerBookingListCardLayers({
      status: "payment_failed",
      paymentStatus: "failed",
      paymentFailureReason: CHECKOUT_EXPIRED_FAILURE_REASON,
      display: baseDisplay,
      assignedCleanerLabel: null,
    });

    expect(layers.dominantBadge.label).toBe("Checkout expired");
    expect(layers.paymentStatusLine?.tone).toBe("attention");
    expect(layers.supportingMessage).toBeNull();
  });

  it("shows team support status when requested and no assignment message", () => {
    const layers = customerBookingListCardLayers({
      status: "confirmed",
      paymentStatus: "paid",
      paymentFailureReason: null,
      display: {
        assignmentCustomerMessage: null,
        isTwoCleanerRequest: true,
        teamSupportLabel: "Team support requested — awaiting confirmation",
      },
      assignedCleanerLabel: null,
    });

    expect(layers.supportingMessage).toEqual({
      kind: "assignment",
      text: "Team support requested — awaiting confirmation",
    });
  });

  it("prefers assignment message over assignment warning badge and cleaner line", () => {
    const layers = customerBookingListCardLayers({
      status: "pending_assignment",
      paymentStatus: "paid",
      paymentFailureReason: null,
      display: {
        assignmentCustomerMessage: "We're finding another available cleaner.",
        isTwoCleanerRequest: false,
        teamSupportLabel: null,
      },
      assignedCleanerLabel: null,
    });

    expect(layers.dominantBadge.label).toBe("Finding cleaner");
    expect(layers.paymentStatusLine).toEqual({ text: "Paid", tone: "muted" });
    expect(layers.supportingMessage).toEqual({
      kind: "assignment",
      text: "We're finding another available cleaner.",
    });
  });

  it("shows assigned cleaner as supporting line when no assignment message", () => {
    const layers = customerBookingListCardLayers({
      status: "assigned",
      paymentStatus: "paid",
      paymentFailureReason: null,
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
      display: baseDisplay,
      assignedCleanerLabel: null,
    });

    expect(layers.dominantBadge.label).toBe("Completed");
    expect(layers.paymentStatusLine).toBeNull();
  });
});
