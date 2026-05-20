import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ADMIN_OPERATIONAL_QUEUES } from "@/features/dashboards/adminOperationalQueues";
import { summarizeCronHealth } from "@/features/dashboards/adminAssignmentsPageDisplay";
import type { CronJobHealthSnapshot } from "@/features/operations/server/cronHealthTypes";
import type { AdminBookingListItem } from "@/features/dashboards/server/types";
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

const sampleBooking: AdminBookingListItem = {
  id: "b1",
  status: "confirmed",
  paymentStatus: "paid",
  paymentFailureReason: "none",
  customerLabel: "Acme Corp",
  cleanerLabel: "Jane Cleaner",
  serviceLabel: "Deep clean",
  scheduleLabel: "Today 12:30",
  scheduledStart: new Date().toISOString(),
  scheduledEnd: new Date().toISOString(),
  priceLabel: "R 500",
  priceCents: 50_000,
  observation: {
    isTwoCleanerRequest: false,
    operationalLoad: {
      isTwoCleanerRequest: false,
      isShaleanEquipment: false,
      isHeavyIntensity: false,
      operationalLoadScore: 0,
    },
    teamRequestFulfillment: null,
    teamRequestFulfillmentLabel: null,
    teamSupportOps: {
      supportingCleaner: null,
      teamSupportNotes: null,
      coordinationStatus: null,
    },
    supportingCleanerLabel: null,
    coordinationStatusLabel: null,
    hasTeamSupportNotes: false,
  },
  assignmentAttention: null,
  updatedAt: new Date().toISOString(),
};

describe("AdminHomeOperationsCenter", () => {
  it("renders hybrid command center sections and dispatch CTA", () => {
    const cronSummary = summarizeCronHealth([criticalJob]);
    const html = renderToStaticMarkup(
      <AdminHomeOperationsCenter
        referenceNow="2026-05-20T12:00:00.000Z"
        queues={queues}
        cronSummary={cronSummary}
        criticalCronJobs={cronSummary.criticalJobs}
        deferredDiagnostics={null}
        assignmentWorkQueueTotal={8}
        payoutSummary={{
          pendingCents: 1000,
          payoutReadyCents: 5000,
          paidCents: 0,
          queue: [{ bookingId: "b1" } as never],
        }}
        attention={[]}
        attentionTotal={0}
        bookings={[sampleBooking]}
        recentBookings={[sampleBooking]}
      />,
    );

    expect(html).toContain('aria-label="Operations command center"');
    expect(html).toContain("Operations");
    expect(html).toContain("Today on Shalean");
    expect(html).toContain("Open dispatch");
    expect(html).toContain("Bookings today");
    expect(html).toContain("Needs attention");
    expect(html).toContain("Live operations");
    expect(html).toContain("Dispatch alerts");
    expect(html).toContain("Support queue");
    expect(html).toContain("Operational rhythm");
    expect(html).toContain("Recent bookings");
    expect(html).toContain("Payout queue");
    expect(html).toContain("Release now");
    expect(html).toContain("Critical cron jobs need attention");
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
        payoutSummary={null}
        attention={[]}
        attentionTotal={0}
        bookings={[]}
        recentBookings={[]}
      />,
    );

    expect(html).toContain("2 deferred dispatch overdue");
  });
});
