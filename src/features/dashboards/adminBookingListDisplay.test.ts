import { describe, expect, it } from "vitest";
import type { AdminBookingListItem } from "@/features/dashboards/server/types";
import {
  adminBookingListNextAction,
  adminBookingListNeedsHighlight,
} from "./adminBookingListDisplay";

type RowInput = Parameters<typeof adminBookingListNextAction>[0];

function row(partial: Partial<RowInput> & Pick<RowInput, "status">): RowInput {
  return {
    serviceLabel: "Regular Cleaning",
    paymentStatus: null,
    paymentFailureReason: "unknown",
    assignmentVisibilityKey: undefined,
    assignmentAttention: null,
    deferredDispatch: undefined,
    observation: {
      isTwoCleanerRequest: false,
      operationalLoad: {
        operationalLoadScore: 0,
        isShaleanEquipment: false,
        isHeavyIntensity: false,
        isTwoCleanerRequest: false,
      },
      teamRequestFulfillment: null,
      teamRequestFulfillmentLabel: null,
      teamSupportOps: {
        coordinationStatus: null,
        supportingCleaner: null,
        teamSupportNotes: null,
      },
      supportingCleanerLabel: null,
      coordinationStatusLabel: null,
      hasTeamSupportNotes: false,
    } as AdminBookingListItem["observation"],
    ...partial,
  };
}

describe("adminBookingListDisplay", () => {
  it("surfaces payment failed next action", () => {
    expect(
      adminBookingListNextAction(
        row({
          status: "payment_failed",
          paymentFailureReason: "card_declined",
        }),
      ),
    ).toContain("retry payment");
  });

  it("highlights deferred dispatch overdue", () => {
    const booking = row({
      status: "confirmed",
      deferredDispatch: {
        phase: "dispatch_overdue",
        adminLabel: "Dispatch overdue",
      } as AdminBookingListItem["deferredDispatch"],
    });
    expect(adminBookingListNextAction(booking)).toContain("overdue");
    expect(adminBookingListNeedsHighlight(booking)).toBe(true);
  });

  it("surfaces team coordination follow-up", () => {
    const booking = row({
      status: "confirmed",
      observation: {
        ...row({ status: "confirmed" }).observation,
        isTwoCleanerRequest: true,
        teamSupportOps: {
          coordinationStatus: { status: "awaiting_coordination" },
          supportingCleaner: null,
          teamSupportNotes: null,
        },
      } as AdminBookingListItem["observation"],
    });
    expect(adminBookingListNextAction(booking)).toContain("coordination");
    expect(adminBookingListNeedsHighlight(booking)).toBe(true);
  });

  it("reframes next action for Airbnb turnovers only", () => {
    const action = adminBookingListNextAction(
      row({
        status: "pending_assignment",
        serviceLabel: "Airbnb Cleaning",
        assignmentVisibilityKey: "needs_assignment",
      }),
    );
    expect(action).toContain("turnover cleaner");
  });
});
