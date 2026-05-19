import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ADMIN_OPERATIONAL_QUEUES,
  buildAdminOperationalQueueCards,
} from "@/features/dashboards/adminOperationalQueues";
import { summarizeCronHealth } from "@/features/dashboards/adminAssignmentsPageDisplay";
import type { CronJobHealthSnapshot } from "@/features/operations/server/cronHealthTypes";
import { AdminHomeCommandCenter } from "./AdminHomeCommandCenter";

const queues = ADMIN_OPERATIONAL_QUEUES.map((q, index) => ({
  key: q.key,
  label: q.label,
  count: index === 4 ? 3 : index,
  href: `/admin/bookings?filter=${q.filter}`,
  tone: q.tone,
}));

const criticalJob: CronJobHealthSnapshot = {
  id: "dispatch",
  name: "Dispatch offers",
  routePath: "/api/cron/dispatch-deferred-assignments",
  scheduleSource: "ops_configured",
  scheduleHint: "Hourly",
  expectedFrequencyMinutes: 60,
  docPath: "docs/cron.md",
  launchRequired: true,
  enabled: true,
  status: "critical",
  statusMessage: "No recent success",
  lastSuccessfulRunAt: null,
  lastFailureRunAt: "2026-01-01T00:00:00Z",
  recentFailureCount24h: 1,
  backlogCount: 0,
  backlogLabel: "Candidates",
  hasRunTelemetry: true,
};

describe("AdminHomeCommandCenter", () => {
  it("renders health tiles, workbench links, and collapsed queue sections", () => {
    const cronSummary = summarizeCronHealth([criticalJob]);
    const html = renderToStaticMarkup(
      <AdminHomeCommandCenter
        queues={queues}
        queueGuideCards={buildAdminOperationalQueueCards(queues)}
        cronSummary={cronSummary}
        criticalCronJobs={cronSummary.criticalJobs}
        deferredDiagnostics={null}
        assignmentWorkQueueTotal={8}
        payoutQueueCount={2}
      />,
    );

    expect(html).toContain('aria-label="Operations command center"');
    expect(html).toContain("Urgent");
    expect(html).toContain("Assignment attention");
    expect(html).toContain("Payment issues");
    expect(html).toContain("Cron health");
    expect(html).toContain("Payout-ready");
    expect(html).toContain("Critical cron jobs need attention");
    expect(html).toContain('href="/admin/assignments"');
    expect(html).toContain('href="/admin/payouts"');
    expect(html).toContain("All operational queues");
    expect(html).toContain("How to use this dashboard");
    expect(html).toMatch(/<details(?![^>]*\bopen\b)[^>]*>[\s\S]*All operational queues/);
    expect(html).toMatch(/<details(?![^>]*\bopen\b)[^>]*>[\s\S]*How to use this dashboard/);
  });

  it("surfaces deferred overdue status", () => {
    const html = renderToStaticMarkup(
      <AdminHomeCommandCenter
        queues={queues}
        queueGuideCards={buildAdminOperationalQueueCards(queues)}
        cronSummary={summarizeCronHealth([])}
        criticalCronJobs={[]}
        deferredDiagnostics={{
          deferredAssignmentEnabled: true,
          awaitingDispatchWindowCount: 0,
          readyForDispatchCount: 0,
          overdueDispatchCount: 2,
          oldestOverdueDispatchAt: null,
          lastCronRun: null,
        }}
        assignmentWorkQueueTotal={0}
        payoutQueueCount={0}
      />,
    );

    expect(html).toContain("2 deferred dispatch overdue");
  });
});
