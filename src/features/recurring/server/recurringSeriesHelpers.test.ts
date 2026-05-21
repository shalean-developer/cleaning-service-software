import { describe, expect, it } from "vitest";
import {
  isPaymentRequiredStatus,
  paymentLabelForBooking,
  resolveSeriesActionsAllowed,
} from "./recurringSeriesHelpers";

describe("resolveSeriesActionsAllowed", () => {
  it("allows admin pause on active series", () => {
    const actions = resolveSeriesActionsAllowed({
      status: "active",
      nextOccurrencePaymentRequired: false,
      nextOccurrenceBookingId: null,
      isCustomer: false,
    });
    expect(actions.canPause).toBe(true);
    expect(actions.canPayNextVisit).toBe(false);
  });

  it("allows customer pay when next child needs payment", () => {
    const actions = resolveSeriesActionsAllowed({
      status: "active",
      nextOccurrencePaymentRequired: true,
      nextOccurrenceBookingId: "child-1",
      isCustomer: true,
    });
    expect(actions.canPayNextVisit).toBe(true);
    expect(actions.canRequestPause).toBe(true);
    expect(actions.canPause).toBe(false);
  });

  it("blocks destructive admin actions on cancelled series", () => {
    const actions = resolveSeriesActionsAllowed({
      status: "cancelled",
      nextOccurrencePaymentRequired: false,
      nextOccurrenceBookingId: null,
      isCustomer: false,
    });
    expect(actions.canPause).toBe(false);
    expect(actions.canCancelSeries).toBe(false);
  });
});

describe("payment detection", () => {
  it("detects payment required for pending_payment", () => {
    expect(isPaymentRequiredStatus("pending_payment")).toBe(true);
    expect(paymentLabelForBooking("pending_payment", null)).toBe("Payment required");
  });

  it("labels paid assigned visits", () => {
    expect(paymentLabelForBooking("assigned", "paid")).toBe("Paid");
  });
});
