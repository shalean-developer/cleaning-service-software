import { describe, expect, it } from "vitest";
import { DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE } from "@/features/assignments/server/deferredDispatchStatus";
import {
  customerBookingAmountLabel,
  customerBookingCompactGuidance,
  customerBookingStatusHero,
  customerBookingWhatHappensNext,
  shouldShowPaymentStatusChip,
  shouldSuppressAssignmentCalloutInDetails,
} from "./customerBookingDetailDisplay";

describe("customerBookingStatusHero", () => {
  it("maps pending_assignment to finding-cleaner reassurance copy", () => {
    const hero = customerBookingStatusHero("pending_assignment", null);
    expect(hero.statusLabel).toBe("Finding cleaner");
    expect(hero.statusLine).toContain("Finding");
    expect(hero.timingHint).toBe("Within 15–60 minutes");
    expect(hero.tone).toBe("warning");
  });

  it("maps completed payout states to customer completed label", () => {
    expect(customerBookingStatusHero("payout_ready", null).statusLabel).toBe("Completed");
    expect(customerBookingStatusHero("paid_out", null).statusLabel).toBe("Completed");
  });

  it("suppresses payment_failed narrative for payment panel", () => {
    const hero = customerBookingStatusHero("payment_failed", null);
    expect(hero.statusLabel).toBe("Payment not completed");
    expect(hero.showStatusNarrative).toBe(false);
    expect(hero.statusLine).toBe("");
  });

  it("uses deferred message as authoritative status line", () => {
    const hero = customerBookingStatusHero("confirmed", null, {
      deferredAssignmentMessage: DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE,
    });
    expect(hero.statusLine).toBe(DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE);
    expect(hero.timingHint).toBe("Closer to your service date");
  });
});

describe("customerBookingCompactGuidance", () => {
  it("returns compact copy for active assignment states", () => {
    const guidance = customerBookingCompactGuidance("pending_assignment");
    expect(guidance?.primary).toContain("matching");
    expect(guidance?.detailSteps?.some((s) => s.title === "Email updates")).toBe(true);
  });

  it("hides when deferred assignment is shown in hero", () => {
    expect(
      customerBookingCompactGuidance("confirmed", {
        deferredAssignmentMessage: DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE,
      }),
    ).toBeNull();
  });

  it("hides for terminal and payment_failed states", () => {
    expect(customerBookingCompactGuidance("completed")).toBeNull();
    expect(customerBookingCompactGuidance("payment_failed")).toBeNull();
  });
});

describe("customerBookingWhatHappensNext", () => {
  it("wraps compact guidance for legacy callers", () => {
    const next = customerBookingWhatHappensNext("pending_assignment");
    expect(next?.steps.length).toBeGreaterThan(0);
    expect(next?.steps.some((s) => s.title === "Email updates")).toBe(true);
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

  it("hides redundant paid chip when status already reflects payment", () => {
    expect(shouldShowPaymentStatusChip("confirmed", "paid")).toBe(false);
    expect(shouldShowPaymentStatusChip("assigned", "paid")).toBe(false);
  });

  it("shows paid chip for pending_assignment when useful", () => {
    expect(shouldShowPaymentStatusChip("pending_assignment", "paid")).toBe(true);
  });
});

describe("shouldSuppressAssignmentCalloutInDetails", () => {
  it("suppresses assignment callout when deferred message is active", () => {
    expect(
      shouldSuppressAssignmentCalloutInDetails({
        deferredAssignmentMessage: DEFERRED_ASSIGNMENT_CUSTOMER_MESSAGE,
        assignmentCustomerMessage: "Finding another cleaner",
      }),
    ).toBe(true);
  });
});
