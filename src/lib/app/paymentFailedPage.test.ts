import { describe, expect, it } from "vitest";
import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
  PAYSTACK_DECLINED_FAILURE_REASON,
} from "@/features/bookings/server/paymentFailureDisplay";
import {
  buildPaymentFailedPageModel,
  formatBookingReferenceLabel,
  parseSafeBookingIdFromSearchParams,
} from "./paymentFailedPage";

const bookingId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

describe("paymentFailedPage", () => {
  it("renders generic copy when reason is absent", () => {
    const model = buildPaymentFailedPageModel({});
    expect(model.copy.title).toBe("Payment not completed");
    expect(model.copy.body).toContain("could not confirm payment");
    expect(model.reassurance).toContain("You were not charged");
    expect(model.bookingDetailHref).toBeNull();
  });

  it("uses checkout_expired copy when reason param is checkout_expired", () => {
    const model = buildPaymentFailedPageModel({
      reason: CHECKOUT_EXPIRED_FAILURE_REASON,
    });
    expect(model.copy.body).toContain("checkout timed out");
    expect(model.paymentFailureReason).toBe(CHECKOUT_EXPIRED_FAILURE_REASON);
  });

  it("uses paystack_declined copy when reason param is paystack_declined", () => {
    const model = buildPaymentFailedPageModel({
      reason: PAYSTACK_DECLINED_FAILURE_REASON,
    });
    expect(model.copy.body).toContain("card provider");
    expect(model.paymentFailureReason).toBe(PAYSTACK_DECLINED_FAILURE_REASON);
  });

  it("does not expose unknown reason strings", () => {
    const model = buildPaymentFailedPageModel({
      reason: "card_declined_insufficient_funds",
    });
    expect(model.paymentFailureReason).toBeNull();
    expect(model.copy.body).not.toContain("insufficient_funds");
    expect(model.copy.body).toContain("could not confirm payment");
  });

  it("links to booking detail when bookingId is a valid UUID", () => {
    const model = buildPaymentFailedPageModel({ bookingId });
    expect(model.bookingDetailHref).toBe(`/customer/bookings/${bookingId}`);
    expect(model.bookingReferenceLabel).toBe(formatBookingReferenceLabel(bookingId));
  });

  it("accepts booking alias param", () => {
    expect(parseSafeBookingIdFromSearchParams({ booking: bookingId })).toBe(bookingId);
  });

  it("rejects non-uuid booking identifiers", () => {
    expect(
      parseSafeBookingIdFromSearchParams({
        bookingId: "not-a-uuid",
        reference: "T12345",
      }),
    ).toBeNull();
    const model = buildPaymentFailedPageModel({ bookingId: "not-a-uuid" });
    expect(model.bookingDetailHref).toBeNull();
  });

  it("falls back to my bookings CTA when no safe booking id", () => {
    const model = buildPaymentFailedPageModel({});
    expect(model.bookingDetailHref).toBeNull();
  });
});
