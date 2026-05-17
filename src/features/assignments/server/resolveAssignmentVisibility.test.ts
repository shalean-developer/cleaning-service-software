import { describe, expect, it } from "vitest";
import { resolveAssignmentVisibility } from "./resolveAssignmentVisibility";

describe("resolveAssignmentVisibility", () => {
  it("shows decline redispatch label for admin when open offer follows decline", () => {
    const v = resolveAssignmentVisibility({
      bookingStatus: "pending_assignment",
      metadata: {
        assignment: {
          status: "offered",
          path: "best_available",
          cleanerId: "cleaner-2",
          offerId: "offer-2",
          reason: null,
          attemptedAt: "2026-05-17T10:00:00.000Z",
          engineVersion: "2026-05-16-phase8",
        },
      },
      hasOpenOffer: true,
      offerStatuses: ["declined", "offered"],
    });
    expect(v.key).toBe("decline_redispatched");
    expect(v.adminLabel).toBe("Cleaner declined — redispatched");
    expect(v.customerMessage).toBe("We're finding another available cleaner.");
    expect(v.showCustomerAssignmentWarning).toBe(false);
  });

  it("shows selected cleaner declined label for admin", () => {
    const v = resolveAssignmentVisibility({
      bookingStatus: "pending_assignment",
      metadata: {
        assignment: {
          status: "attention_required",
          path: "selected",
          cleanerId: "cleaner-1",
          offerId: "offer-1",
          reason: "Cleaner declined offer; selected cleaner requires admin redispatch.",
          attemptedAt: "2026-05-17T10:00:00.000Z",
          engineVersion: "2026-05-16-phase8",
          lastOfferOutcome: "declined",
        },
      },
      hasOpenOffer: false,
      offerStatuses: ["declined"],
    });
    expect(v.key).toBe("selected_declined_admin");
    expect(v.adminLabel).toBe("Selected cleaner declined — admin action needed");
    expect(v.customerMessage).toBe(
      "We're reviewing cleaner availability for your booking.",
    );
    expect(v.showCustomerAssignmentWarning).toBe(true);
  });

  it("shows max attempts label for admin", () => {
    const v = resolveAssignmentVisibility({
      bookingStatus: "pending_assignment",
      metadata: {
        assignment: {
          status: "attention_required",
          path: "best_available",
          cleanerId: null,
          offerId: null,
          reason:
            "Maximum assignment dispatch attempts reached after cleaner declined offer.",
          attemptedAt: "2026-05-17T10:00:00.000Z",
          engineVersion: "2026-05-16-phase8",
        },
      },
      hasOpenOffer: false,
      offerStatuses: ["declined", "declined", "declined", "declined", "declined"],
    });
    expect(v.key).toBe("max_attempts_admin");
    expect(v.adminLabel).toBe("No cleaner accepted after dispatch attempts");
  });

  it("shows calm redispatch copy for customer without internal decline details", () => {
    const v = resolveAssignmentVisibility({
      bookingStatus: "pending_assignment",
      metadata: {
        assignment: {
          status: "offered",
          path: "best_available",
          cleanerId: "cleaner-2",
          offerId: "offer-2",
          reason: null,
          attemptedAt: "2026-05-17T10:00:00.000Z",
          engineVersion: "2026-05-16-phase8",
        },
      },
      hasOpenOffer: true,
      offerStatuses: ["declined", "offered"],
    });
    expect(v.customerMessage).toBe("We're finding another available cleaner.");
    expect(v.adminLabel).not.toContain("cleaner-");
    expect(v.showCustomerAssignmentWarning).toBe(false);
  });

  it("handles old bookings without assignment metadata", () => {
    const v = resolveAssignmentVisibility({
      bookingStatus: "pending_assignment",
      metadata: { suburb: "Sea Point" },
      hasOpenOffer: false,
      offerStatuses: [],
    });
    expect(v.key).toBe("finding_cleaner");
    expect(v.customerMessage).toBeNull();
    expect(v.showCustomerAssignmentWarning).toBe(false);
  });

  it("returns null visibility for non-pending bookings", () => {
    const v = resolveAssignmentVisibility({
      bookingStatus: "confirmed",
      metadata: {
        assignment: { status: "attention_required", path: "selected" },
      },
      hasOpenOffer: false,
      offerStatuses: [],
    });
    expect(v.key).toBeNull();
  });
});
