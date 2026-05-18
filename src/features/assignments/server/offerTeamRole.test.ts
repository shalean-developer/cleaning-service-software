import { describe, expect, it } from "vitest";
import type { AssignmentOfferRow } from "@/lib/database/types";
import { offerBookingStatusAllowed } from "./offerTeamRole";

describe("offerBookingStatusAllowed", () => {
  it("primary offers require pending_assignment", () => {
    const offer = { team_role: "primary" } as AssignmentOfferRow;
    expect(offerBookingStatusAllowed(offer, "pending_assignment")).toBe(true);
    expect(offerBookingStatusAllowed(offer, "assigned")).toBe(false);
  });

  it("support offers require active assigned job", () => {
    const offer = { team_role: "support" } as AssignmentOfferRow;
    expect(offerBookingStatusAllowed(offer, "assigned")).toBe(true);
    expect(offerBookingStatusAllowed(offer, "in_progress")).toBe(true);
    expect(offerBookingStatusAllowed(offer, "pending_assignment")).toBe(false);
  });
});
