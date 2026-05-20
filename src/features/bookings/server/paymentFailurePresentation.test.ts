import { describe, expect, it } from "vitest";
import { buildPaymentFailedPageModel } from "@/lib/app/paymentFailedPage";
import {
  paymentFailedReturnPageNextSteps,
  paymentIssueDetailSteps,
} from "./paymentFailurePresentation";

describe("paymentFailurePresentation (Sprint B)", () => {
  it("returns a single next step when booking detail is available", () => {
    const model = buildPaymentFailedPageModel({
      bookingId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    });
    const steps = paymentFailedReturnPageNextSteps(model);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toContain("Retry payment");
    expect(steps[0]).toContain("fresh secure checkout");
  });

  it("groups detail-only retry and assignment copy for booking detail panel", () => {
    const steps = paymentIssueDetailSteps({
      assignmentNote: "Complete checkout to confirm your booking and assign a cleaner.",
      slotWarning: null,
      canRetryPayment: true,
    });
    expect(steps.some((s) => s.includes("fresh secure checkout"))).toBe(true);
    expect(steps.some((s) => s.includes("Complete checkout"))).toBe(true);
  });
});
