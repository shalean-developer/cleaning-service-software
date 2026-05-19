import { describe, expect, it } from "vitest";
import type { AdminAssignmentQueueItem } from "./server/types";
import {
  cronHealthNeedsAttention,
  deferredDiagnosticsNeedsAttention,
  matchesAssignmentQueuePreset,
  queueCountForPreset,
  summarizeCronHealth,
} from "./adminAssignmentsPageDisplay";
import type { CronJobHealthSnapshot } from "@/features/operations/server/cronHealthTypes";

function queueItem(
  overrides: Partial<AdminAssignmentQueueItem> = {},
): AdminAssignmentQueueItem {
  return {
    bookingId: "b1",
    status: "confirmed",
    customerLabel: "Sam",
    serviceLabel: "Regular cleaning",
    scheduleLabel: "Mon 9 Jun",
    assignmentAttention: "dispatch_not_started",
    assignmentReason: null,
    openOffers: [],
    queueReason: "Dispatch not started",
    opsSearching: false,
    opsAdminRequired: true,
    recoveryCronCanHandle: true,
    manualInterventionNeeded: false,
    runbookKey: null,
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const healthyJob: CronJobHealthSnapshot = {
  id: "recover",
  name: "Recover assignment",
  routePath: "/api/cron/recover",
  scheduleSource: "ops_configured",
  scheduleHint: "Every 5 min",
  expectedFrequencyMinutes: 5,
  docPath: "docs/cron.md",
  launchRequired: true,
  enabled: true,
  status: "healthy",
  statusMessage: "OK",
  lastSuccessfulRunAt: "2026-01-01T00:00:00Z",
  lastFailureRunAt: null,
  recentFailureCount24h: 0,
  backlogCount: 0,
  backlogLabel: "Backlog",
  hasRunTelemetry: true,
};

describe("adminAssignmentsPageDisplay", () => {
  it("summarizes cron health worst level", () => {
    const summary = summarizeCronHealth([
      healthyJob,
      { ...healthyJob, id: "expire", status: "critical", statusMessage: "Stale" },
    ]);
    expect(summary.worstLevel).toBe("critical");
    expect(summary.criticalCount).toBe(1);
    expect(cronHealthNeedsAttention(summary)).toBe(true);
  });

  it("flags deferred overdue diagnostics", () => {
    expect(
      deferredDiagnosticsNeedsAttention({
        deferredAssignmentEnabled: true,
        awaitingDispatchWindowCount: 1,
        readyForDispatchCount: 0,
        overdueDispatchCount: 2,
        oldestOverdueDispatchAt: "2026-01-01T00:00:00Z",
        lastCronRun: null,
      }),
    ).toBe(true);
  });

  it("filters assignment queue presets client-side", () => {
    const items = [
      queueItem({ opsAdminRequired: true }),
      queueItem({
        bookingId: "b2",
        opsAdminRequired: false,
        openOffers: [],
        status: "confirmed",
        recoveryCronCanHandle: true,
      }),
      queueItem({
        bookingId: "b3",
        assignmentReason: "Last offer expired",
        assignmentAttention: "max_attempts_admin",
        opsAdminRequired: false,
        manualInterventionNeeded: false,
      }),
    ];
    expect(queueCountForPreset(items, "needs_attention")).toBe(1);
    expect(matchesAssignmentQueuePreset(items[1]!, "paid_no_offer")).toBe(true);
    expect(matchesAssignmentQueuePreset(items[2]!, "offer_expired")).toBe(true);
  });
});
