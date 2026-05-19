import { describe, expect, it } from "vitest";
import {
  adminDeferredDispatchNeedsAttention,
  adminEarningsNeedsAttention,
  adminTeamSupportNeedsFollowUp,
  buildAdminBookingHeroEssentialRows,
} from "./adminBookingDetailDisplay";
import type { AdminTeamEarningsReconciliation } from "./server/types";

describe("adminBookingDetailDisplay", () => {
  it("builds compact essential hero rows", () => {
    const rows = buildAdminBookingHeroEssentialRows({
      scheduleLabel: "Mon 9 Jun",
      locationSummary: "Sea Point",
      customerLabel: "Sam",
      cleanerLabel: null,
      priceLabel: "R 477.00",
    });
    expect(rows.map((r) => r.label)).toEqual([
      "When",
      "Where",
      "Customer",
      "Cleaner",
      "Total",
    ]);
    expect(rows.find((r) => r.label === "Cleaner")?.value).toBe("Unassigned");
  });

  it("detects team support follow-up", () => {
    expect(
      adminTeamSupportNeedsFollowUp({
        isTwoCleanerRequest: true,
        teamRequestFulfillment: null,
        teamSupportOps: { coordinationStatus: null, supportingCleaner: null, teamSupportNotes: null },
      }),
    ).toBe(true);
    expect(
      adminTeamSupportNeedsFollowUp({
        isTwoCleanerRequest: false,
        teamRequestFulfillment: null,
        teamSupportOps: { coordinationStatus: null, supportingCleaner: null, teamSupportNotes: null },
      }),
    ).toBe(false);
  });

  it("detects earnings attention for blocked reconciliation", () => {
    const blocked: AdminTeamEarningsReconciliation = {
      enabled: true,
      status: "blocked",
      blockingIssues: [
        { code: "POOL_MISMATCH", severity: "error", message: "Totals do not match" },
      ],
      warnings: [],
      issues: [],
      totalPoolCents: 1000,
      expectedShareCents: 500,
      recordedPayoutCents: 400,
      splitPolicy: "equal",
      expectedParticipantCount: 2,
      canMarkPayoutReady: false,
    };
    expect(adminEarningsNeedsAttention(blocked)).toBe(true);
  });

  it("detects overdue deferred dispatch", () => {
    expect(
      adminDeferredDispatchNeedsAttention({
        phase: "dispatch_overdue",
        assignmentDispatchAt: null,
        daysUntilDispatch: null,
        hoursUntilDispatch: null,
        hoursOverdue: 2,
        scheduledStart: null,
        adminLabel: "Overdue",
        adminOperationalCopy: "Dispatch overdue",
        customerMessage: null,
        operationalAttentionRequired: true,
      }),
    ).toBe(true);
  });
});
