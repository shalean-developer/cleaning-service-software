import { describe, expect, it, vi } from "vitest";
import { testCurrentUser } from "@/test/fixtures";
import { computeDeferredDispatchNowEligible } from "./deferredDispatchNowEligibility";
import { runAdminDeferredDispatchNow } from "./adminDeferredDispatchNow";

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => null,
}));

describe("computeDeferredDispatchNowEligible", () => {
  it("requires confirmed paid deferred booking without open offers", () => {
    expect(
      computeDeferredDispatchNowEligible({
        bookingStatus: "confirmed",
        hasAssignedCleaner: false,
        hasPaidPayment: true,
        assignmentDispatchAt: "2026-06-01T00:00:00.000Z",
        openOfferCount: 0,
      }),
    ).toBe(true);

    expect(
      computeDeferredDispatchNowEligible({
        bookingStatus: "confirmed",
        hasAssignedCleaner: false,
        hasPaidPayment: true,
        assignmentDispatchAt: null,
        openOfferCount: 0,
      }),
    ).toBe(false);

    expect(
      computeDeferredDispatchNowEligible({
        bookingStatus: "confirmed",
        hasAssignedCleaner: false,
        hasPaidPayment: true,
        assignmentDispatchAt: "2026-06-01T00:00:00.000Z",
        openOfferCount: 1,
      }),
    ).toBe(false);
  });
});

describe("runAdminDeferredDispatchNow", () => {
  it("rejects when service role is not configured", async () => {
    const result = await runAdminDeferredDispatchNow(
      testCurrentUser({ profileId: "admin-1", authUser: { email: "a@test.com" } }),
      "booking-1",
      { reason: "Staging test dispatch now" },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_NOT_CONFIGURED");
    }
  });
});
