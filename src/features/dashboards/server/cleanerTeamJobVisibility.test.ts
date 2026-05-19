import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssignmentOfferRow, BookingCleanerRow } from "@/lib/database/types";
import {
  buildCleanerJobTeamContext,
  buildSupportParticipationContext,
  cleanerCanViewJobDetail,
  labelForCleanerViewerRole,
  labelForOfferTeamRole,
  resolveCleanerViewerRole,
  resolveSupportOfferEarningsDisplay,
  SUPPORT_CLEANER_EARNINGS_LABEL,
} from "./cleanerTeamJobVisibility";
import { offerBookingStatusAllowed } from "@/features/assignments/server/offerTeamRole";

vi.mock("@/features/assignments/server/teamOffersConfig", () => ({
  isTeamOffersEnabled: vi.fn(() => true),
}));

describe("cleanerTeamJobVisibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lead cleaner resolves from bookings.cleaner_id", () => {
    expect(
      resolveCleanerViewerRole("cleaner-lead", "cleaner-lead", null, true),
    ).toBe("lead");
    expect(labelForCleanerViewerRole("lead")).toBe("Lead cleaner");
  });

  it("support cleaner resolves from accepted roster row", () => {
    const roster: Pick<BookingCleanerRow, "cleaner_id" | "role" | "status"> = {
      cleaner_id: "cleaner-support",
      role: "support",
      status: "accepted",
    };
    expect(
      resolveCleanerViewerRole("cleaner-lead", "cleaner-support", roster, true),
    ).toBe("support");
    expect(labelForCleanerViewerRole("support")).toBe("Support cleaner");
  });

  it("offered roster alone does not grant job detail access", () => {
    const roster: Pick<BookingCleanerRow, "cleaner_id" | "role" | "status"> = {
      cleaner_id: "cleaner-support",
      role: "support",
      status: "offered",
    };
    expect(
      cleanerCanViewJobDetail("cleaner-lead", "cleaner-support", roster, true),
    ).toBe(false);
  });

  it("accepted support roster grants job detail access without changing cleaner_id", () => {
    const roster: Pick<BookingCleanerRow, "cleaner_id" | "role" | "status"> = {
      cleaner_id: "cleaner-support",
      role: "support",
      status: "accepted",
    };
    expect(
      cleanerCanViewJobDetail("cleaner-lead", "cleaner-support", roster, true),
    ).toBe(true);
  });

  it("support offer earnings use neutral operations copy", () => {
    const display = resolveSupportOfferEarningsDisplay();
    expect(display.earningsCents).toBeNull();
    expect(display.earningsLabel).toBe(SUPPORT_CLEANER_EARNINGS_LABEL);
  });

  it("support offers require assigned or in_progress booking status", () => {
    const supportOffer = { team_role: "support" } as AssignmentOfferRow;
    const primaryOffer = { team_role: "primary" } as AssignmentOfferRow;
    expect(offerBookingStatusAllowed(supportOffer, "assigned")).toBe(true);
    expect(offerBookingStatusAllowed(supportOffer, "in_progress")).toBe(true);
    expect(offerBookingStatusAllowed(supportOffer, "pending_assignment")).toBe(false);
    expect(offerBookingStatusAllowed(primaryOffer, "pending_assignment")).toBe(true);
    expect(offerBookingStatusAllowed(primaryOffer, "assigned")).toBe(false);
  });

  it("labels support offer team role when team offers enabled", () => {
    expect(labelForOfferTeamRole({ team_role: "support" })).toBe("Support cleaner");
    expect(labelForOfferTeamRole({ team_role: "primary" })).toBeNull();
  });

  it("support viewer cannot start or complete", () => {
    const team = buildCleanerJobTeamContext("support", [], true);
    expect(team.canStartJob).toBe(false);
    expect(team.canCompleteJob).toBe(false);
    expect(team.viewerRole).toBe("support");
    expect(team.supportParticipation.canMarkParticipation).toBe(false);
  });

  it("lead viewer can start and complete", () => {
    const team = buildCleanerJobTeamContext("lead", [], false);
    expect(team.canStartJob).toBe(true);
    expect(team.canCompleteJob).toBe(true);
    expect(team.supportParticipation.canMarkParticipation).toBe(false);
  });

  it("support can mark participation when roster accepted and job in progress", () => {
    const ctx = buildSupportParticipationContext(
      "support",
      {
        status: "accepted",
        support_completed_at: null,
        support_note: null,
      },
      "in_progress",
    );
    expect(ctx.canMarkParticipation).toBe(true);
    expect(ctx.hasMarkedParticipation).toBe(false);
  });

  it("support cannot mark participation before job in progress", () => {
    const ctx = buildSupportParticipationContext(
      "support",
      {
        status: "accepted",
        support_completed_at: null,
        support_note: null,
      },
      "assigned",
    );
    expect(ctx.canMarkParticipation).toBe(false);
  });

  it("support participation shows completed state", () => {
    const ctx = buildSupportParticipationContext(
      "support",
      {
        status: "completed",
        support_completed_at: "2026-05-25T12:00:00.000Z",
        support_note: "Done",
      },
      "completed",
    );
    expect(ctx.hasMarkedParticipation).toBe(true);
    expect(ctx.canMarkParticipation).toBe(false);
  });
});
