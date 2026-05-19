import { describe, expect, it } from "vitest";
import {
  buildAdminHomeHealthTiles,
  computeAdminHomeUrgentCount,
  queueCountByKey,
} from "./adminHomeDisplay";
import type { AdminOperationalQueueCountItem } from "./server/adminOperationalQueueCounts";
import { summarizeCronHealth } from "./adminAssignmentsPageDisplay";
import type { CronJobHealthSnapshot } from "@/features/operations/server/cronHealthTypes";

const queues: AdminOperationalQueueCountItem[] = [
  {
    key: "payment_attention",
    label: "Payment attention",
    count: 2,
    href: "/admin/bookings?filter=payment_failed",
    tone: "danger",
  },
  {
    key: "assignment_attention",
    label: "Assignment attention",
    count: 5,
    href: "/admin/bookings?filter=assignment_attention",
    tone: "warning",
  },
  {
    key: "needs_assignment",
    label: "Needs assignment",
    count: 1,
    href: "/admin/bookings?filter=pending_assignment",
    tone: "warning",
  },
  {
    key: "dispatch_not_started",
    label: "Dispatch not started",
    count: 0,
    href: "/admin/bookings?filter=dispatch_not_started",
    tone: "warning",
  },
  {
    key: "recovery_needed",
    label: "Recovery needed",
    count: 0,
    href: "/admin/bookings?filter=recovery_needed",
    tone: "info",
  },
];

function cronJobs(level: CronJobHealthSnapshot["status"]): CronJobHealthSnapshot[] {
  return [
    {
      id: "recover",
      name: "Recover assignments",
      routePath: "/api/cron/recover-assignments",
      scheduleSource: "ops_configured",
      scheduleHint: "Every 15m",
      expectedFrequencyMinutes: 15,
      docPath: "docs/cron.md",
      launchRequired: true,
      enabled: true,
      status: level,
      statusMessage: "test",
      lastSuccessfulRunAt: level === "healthy" ? "2026-01-01T00:00:00Z" : null,
      lastFailureRunAt: null,
      recentFailureCount24h: null,
      backlogCount: 0,
      backlogLabel: "Candidates",
      hasRunTelemetry: true,
    },
  ];
}

describe("adminHomeDisplay", () => {
  it("queueCountByKey returns count for known queue", () => {
    expect(queueCountByKey(queues, "payment_attention")).toBe(2);
    expect(queueCountByKey(queues, "recovery_needed")).toBe(0);
  });

  it("computeAdminHomeUrgentCount sums payment, cron critical, and deferred overdue", () => {
    const cronSummary = summarizeCronHealth(cronJobs("critical"));
    expect(
      computeAdminHomeUrgentCount({
        queues,
        cronSummary,
        deferredDiagnostics: {
          deferredAssignmentEnabled: true,
          awaitingDispatchWindowCount: 0,
          readyForDispatchCount: 0,
          overdueDispatchCount: 3,
          oldestOverdueDispatchAt: null,
          lastCronRun: null,
        },
      }),
    ).toBe(2 + 1 + 3);
  });

  it("buildAdminHomeHealthTiles links assignments and payments to workbenches", () => {
    const tiles = buildAdminHomeHealthTiles({
      queues,
      cronSummary: summarizeCronHealth(cronJobs("healthy")),
      deferredDiagnostics: null,
      assignmentWorkQueueTotal: 12,
      payoutQueueCount: 4,
    });

    expect(tiles.find((t) => t.id === "assignments")).toMatchObject({
      value: "5",
      href: "/admin/assignments",
      cta: "Open workbench",
    });
    expect(tiles.find((t) => t.id === "payments")).toMatchObject({
      value: "2",
      href: "/admin/bookings?filter=payment_failed",
    });
    expect(tiles.find((t) => t.id === "payouts")).toMatchObject({
      value: "4",
      href: "/admin/payouts",
    });
    expect(tiles.find((t) => t.id === "cron")).toMatchObject({
      value: "Healthy",
      tone: "success",
    });
  });

  it("marks cron tile critical when jobs are critical", () => {
    const tiles = buildAdminHomeHealthTiles({
      queues,
      cronSummary: summarizeCronHealth(cronJobs("critical")),
      deferredDiagnostics: null,
      assignmentWorkQueueTotal: 0,
      payoutQueueCount: 0,
    });

    expect(tiles.find((t) => t.id === "cron")).toMatchObject({
      value: "1 critical",
      tone: "danger",
      emphasize: true,
    });
  });
});
