import { describe, expect, it } from "vitest";
import { resolveSeriesActionsAllowed, isPaymentRequiredStatus } from "./recurringSeriesHelpers";

/**
 * Payment-required hardening: customer pay-next-visit gates and status guards.
 * Checkout uses startPaymentRetryCheckout (see PayNextVisitButton / retryPaymentFlow).
 */
describe("recurring payment-required hardening", () => {
  it("allows pay next visit only for active series with unpaid next child", () => {
    const actions = resolveSeriesActionsAllowed({
      status: "active",
      nextOccurrencePaymentRequired: true,
      nextOccurrenceBookingId: "child-booking-1",
      isCustomer: true,
    });
    expect(actions.canPayNextVisit).toBe(true);
  });

  it("blocks pay next visit when series is paused", () => {
    const actions = resolveSeriesActionsAllowed({
      status: "paused",
      nextOccurrencePaymentRequired: true,
      nextOccurrenceBookingId: "child-booking-1",
      isCustomer: true,
    });
    expect(actions.canPayNextVisit).toBe(false);
  });

  it("treats pending_payment as payment-required", () => {
    expect(isPaymentRequiredStatus("pending_payment")).toBe(true);
    expect(isPaymentRequiredStatus("confirmed")).toBe(false);
    expect(isPaymentRequiredStatus("assigned")).toBe(false);
  });

  it("does not expose dispatch-ready statuses as payment-required", () => {
    expect(isPaymentRequiredStatus("pending_assignment")).toBe(false);
    expect(isPaymentRequiredStatus("assigned")).toBe(false);
  });
});
