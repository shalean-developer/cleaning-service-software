import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ADMIN_OPERATIONAL_QUEUES } from "@/features/dashboards/adminOperationalQueues";
import { summarizeCronHealth } from "@/features/dashboards/adminAssignmentsPageDisplay";
import type { CronJobHealthSnapshot } from "@/features/operations/server/cronHealthTypes";
import {
  buildAdminHomePayoutSummaryView,
  buildAdminHomeRhythmPresentation,
  buildAdminHomeSnapshotPresentation,
  buildAdminHomeTodaySnapshotFromCounts,
} from "@/features/dashboards/adminHomeOperationsDisplay";
import { AdminHomeOperationsCenter } from "./AdminHomeOperationsCenter";

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

const snapshot = buildAdminHomeTodaySnapshotFromCounts({
  bookingsToday: 4,
  bookingsConfirmed: 2,
  bookingsDone: 1,
  cleanersActive: 3,
  revenueTodayCents: 120_000,
});

const rhythm = buildAdminHomeRhythmPresentation(
  {
    recurringActive: 5,
    confirmedToday: 2,
    attentionNeeded: 3,
    completedVisitsToday: 1,
  },
  8,
);

const snapshotPresentation = buildAdminHomeSnapshotPresentation({
  snapshot: { ...snapshot, activeIssues: 0 },
  upcoming: null,
  matchingPending: 0,
  recurringActive: 5,
});

const payoutView = buildAdminHomePayoutSummaryView({
  pendingCents: 1000,
  payoutReadyCents: 5000,
  paidCents: 0,
  queue: [{ bookingId: "b1" } as never],
});

describe("AdminHomeOperationsCenter", () => {
  it("renders premium operations command center sections", () => {
    const cronSummary = summarizeCronHealth([criticalJob]);
    const html = renderToStaticMarkup(
      <AdminHomeOperationsCenter
        referenceNow="2026-05-20T12:00:00.000Z"
        queues={queues}
        cronSummary={cronSummary}
        criticalCronJobs={cronSummary.criticalJobs}
        deferredDiagnostics={null}
        assignmentWorkQueueTotal={8}
        snapshot={snapshot}
        snapshotPresentation={snapshotPresentation}
        liveFeed={[]}
        dispatchAlerts={[]}
        supportRows={[]}
        rhythm={rhythm}
        payoutView={payoutView}
      />,
    );

    expect(html).toContain('aria-label="Operations command center"');
    expect(html).toContain("Today on Shalean");
    expect(html).toContain("Today snapshot");
    expect(html).toContain("Bookings today");
    expect(html).toContain("Live operations");
    expect(html).toContain("Dispatch alerts");
    expect(html).toContain("Support queue");
    expect(html).toContain("Operational rhythm");
    expect(html).toContain("Weekly payouts ready");
    expect(html).toContain("Release now");
    expect(html).toContain("Open earnings");
    expect(html).toContain("Critical cron jobs need attention");
    expect(html).not.toContain("Needs attention");
    expect(html).not.toContain("Recent bookings");
  });

  it("surfaces deferred overdue status", () => {
    const html = renderToStaticMarkup(
      <AdminHomeOperationsCenter
        referenceNow="2026-05-20T12:00:00.000Z"
        queues={queues}
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
        snapshot={buildAdminHomeTodaySnapshotFromCounts({
          bookingsToday: 0,
          bookingsConfirmed: 0,
          bookingsDone: 0,
          cleanersActive: 0,
          revenueTodayCents: 0,
        })}
        snapshotPresentation={buildAdminHomeSnapshotPresentation({
          snapshot: buildAdminHomeTodaySnapshotFromCounts({
            bookingsToday: 0,
            bookingsConfirmed: 0,
            bookingsDone: 0,
            cleanersActive: 0,
            revenueTodayCents: 0,
          }),
          upcoming: null,
          matchingPending: 0,
          recurringActive: 0,
        })}
        liveFeed={[]}
        dispatchAlerts={[]}
        supportRows={[]}
        rhythm={buildAdminHomeRhythmPresentation(
          {
            recurringActive: 0,
            confirmedToday: 0,
            attentionNeeded: 0,
            completedVisitsToday: 0,
          },
          0,
        )}
        payoutView={buildAdminHomePayoutSummaryView(null)}
      />,
    );

    expect(html).toContain("2 deferred dispatch overdue");
  });

  it("renders quiet-state copy when operational data is empty", () => {
    const emptySnapshot = buildAdminHomeTodaySnapshotFromCounts({
      bookingsToday: 0,
      bookingsConfirmed: 0,
      bookingsDone: 0,
      cleanersActive: 0,
      revenueTodayCents: 0,
    });
    const html = renderToStaticMarkup(
      <AdminHomeOperationsCenter
        referenceNow="2026-05-21T10:00:00+02:00"
        queues={queues.map((q) => ({ ...q, count: 0 }))}
        cronSummary={summarizeCronHealth([])}
        criticalCronJobs={[]}
        deferredDiagnostics={null}
        assignmentWorkQueueTotal={0}
        snapshot={emptySnapshot}
        snapshotPresentation={buildAdminHomeSnapshotPresentation({
          snapshot: { ...emptySnapshot, activeIssues: 0 },
          upcoming: {
            upcomingBookingsCount: 1,
            nextUpcomingScheduledStart: "2026-05-22T09:00:00+02:00",
            nextUpcomingDayLabel: "tomorrow",
            futurePaidBookingsCount: 0,
            cleanersInSystemCount: 1,
          },
          matchingPending: 0,
          recurringActive: 0,
        })}
        liveFeed={[]}
        dispatchAlerts={[]}
        supportRows={[]}
        rhythm={buildAdminHomeRhythmPresentation(
          {
            recurringActive: 0,
            confirmedToday: 0,
            attentionNeeded: 0,
            completedVisitsToday: 0,
          },
          0,
        )}
        payoutView={buildAdminHomePayoutSummaryView({
          pendingCents: 0,
          payoutReadyCents: 0,
          paidCents: 0,
          queue: [],
        })}
      />,
    );

    expect(html).toContain("0 confirmed · 0 done");
    expect(html).toContain("0 recurring active");
    expect(html).toContain("1 upcoming tomorrow");
    expect(html).toContain("Dispatch queue is clear");
    expect(html).toContain("No open customer support signals");
    expect(html).toContain("No recent operational activity");
    expect(html).toContain("Nothing awaiting release");
    expect(html).not.toContain("Mock");
  });
});
