import { describe, expect, it } from "vitest";
import {
  customerBookingAmountLabel,
  customerBookingStatusHero,
  customerBookingWhatHappensNext,
  shouldShowPaymentStatusChip,
} from "./customerBookingDetailDisplay";

describe("customerBookingStatusHero", () => {
  it("maps pending_assignment to finding-cleaner reassurance copy", () => {
    const hero = customerBookingStatusHero("pending_assignment", null);
    expect(hero.statusLabel).toBe("Finding cleaner");
    expect(hero.description).toContain("finding");
    expect(hero.expectedUpdate).toBe("Within 15–60 minutes");
    expect(hero.tone).toBe("warning");
  });

  it("maps completed payout states to customer completed label", () => {
    expect(customerBookingStatusHero("payout_ready", null).statusLabel).toBe("Completed");
    expect(customerBookingStatusHero("paid_out", null).statusLabel).toBe("Completed");
  });
});

describe("customerBookingWhatHappensNext", () => {
  it("returns structured steps for active assignment states", () => {
    const next = customerBookingWhatHappensNext("pending_assignment");
    expect(next?.steps).toHaveLength(4);
    expect(next?.steps[0]?.title).toBe("Payment confirmed");
    expect(next?.steps.some((s) => s.title === "Email updates")).toBe(true);
  });

  it("hides for terminal states", () => {
    expect(customerBookingWhatHappensNext("completed")).toBeNull();
    expect(customerBookingWhatHappensNext("payment_failed")).toBeNull();
  });
});

describe("customerBookingAmountLabel", () => {
  it("labels amount due for unpaid paths", () => {
    expect(customerBookingAmountLabel("pending_payment", null)).toBe("Amount due");
    expect(customerBookingAmountLabel("payment_failed", "failed")).toBe("Amount due");
  });

  it("labels amount paid when payment succeeded", () => {
    expect(customerBookingAmountLabel("confirmed", "paid")).toBe("Amount paid");
  });
});

describe("shouldShowPaymentStatusChip", () => {
  it("hides payment chip when booking payment failed", () => {
    expect(shouldShowPaymentStatusChip("payment_failed", "failed")).toBe(false);
  });

  it("shows payment chip when payment status exists", () => {
    expect(shouldShowPaymentStatusChip("assigned", "paid")).toBe(true);
  });
});
