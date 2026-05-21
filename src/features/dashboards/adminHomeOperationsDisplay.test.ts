import { describe, expect, it } from "vitest";
import {
  buildAdminHomeLiveFeedFromEvents,
  buildAdminHomePayoutSummaryView,
  buildAdminHomeSnapshotPresentation,
  buildAdminHomeTodaySnapshot,
  buildAdminHomeWorkbenchRows,
  withActiveIssuesCount,
} from "./adminHomeOperationsDisplay";
import { buildAdminHomeTodaySnapshotFromCounts } from "./adminHomeOperationsDisplay";
import type { AdminOperationalQueueCountItem } from "./server/adminOperationalQueueCounts";
import { summarizeCronHealth } from "./adminAssignmentsPageDisplay";
import type { AdminBookingListItem } from "./server/types";

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
    count: 1,
    href: "/admin/bookings?filter=assignment_attention",
    tone: "warning",
  },
  {
    key: "needs_assignment",
    label: "Needs assignment",
    count: 0,
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

function booking(partial: Partial<AdminBookingListItem> & Pick<AdminBookingListItem, "id">): AdminBookingListItem {
  return {
    status: "confirmed",
    paymentStatus: "paid",
    paymentFailureReason: "none",
    customerLabel: "Acme",
    cleanerLabel: "Jane",
    serviceLabel: "Standard clean",
    scheduleLabel: "Today",
    scheduledStart: new Date().toISOString(),
    priceLabel: "R 100",
    priceCents: 10_000,
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
    ...partial,
  };
}

describe("adminHomeOperationsDisplay", () => {
  it("buildAdminHomeTodaySnapshot counts scheduled-today bookings", () => {
    const snapshot = buildAdminHomeTodaySnapshot([
      booking({ id: "a", scheduledStart: new Date().toISOString(), cleanerLabel: "A" }),
      booking({ id: "b", scheduledStart: new Date(Date.now() + 86_400_000).toISOString() }),
    ]);

    expect(snapshot.bookingsToday).toBe(1);
    expect(snapshot.cleanersActive).toBe(1);
  });

  it("withActiveIssuesCount uses urgent composite without changing backend counts", () => {
    const base = buildAdminHomeTodaySnapshot([]);
    const enriched = withActiveIssuesCount(base, {
      queues,
      cronSummary: summarizeCronHealth([]),
      deferredDiagnostics: null,
    });

    expect(enriched.activeIssues).toBe(2);
  });

  it("buildAdminHomeSnapshotPresentation adds upcoming context without changing counts", () => {
    const snapshot = buildAdminHomeTodaySnapshotFromCounts({
      bookingsToday: 0,
      bookingsConfirmed: 0,
      bookingsDone: 0,
      cleanersActive: 0,
      revenueTodayCents: 0,
    });
    const presentation = buildAdminHomeSnapshotPresentation({
      snapshot: { ...snapshot, activeIssues: 0 },
      upcoming: {
        upcomingBookingsCount: 1,
        nextUpcomingScheduledStart: "2026-05-22T09:00:00+02:00",
        nextUpcomingDayLabel: "tomorrow",
        futurePaidBookingsCount: 1,
        cleanersInSystemCount: 2,
      },
      matchingPending: 0,
      recurringActive: 0,
    });

    expect(presentation.summarySuffix).toContain("1 upcoming");
    expect(presentation.summarySuffix).toContain("tomorrow");
    expect(presentation.bookingsFooter).toBe("0 confirmed · 0 done");
    expect(presentation.cleanersFooter).toBe("Assigned on today's schedule");
    expect(presentation.revenueFooter).toBe("0 recurring active");
    expect(presentation.issuesFooter).toBe("Queues clear");
  });

  it("buildAdminHomeLiveFeedFromEvents handles missing booking labels safely", () => {
    const items = buildAdminHomeLiveFeedFromEvents({
      events: [
        {
          id: "evt-1",
          bookingId: "deleted-booking",
          at: "2026-05-21T10:00:00Z",
          source: "booking_audit",
          kind: "payment",
          title: "Payment confirmed",
          detail: null,
        },
        {
          id: "evt-archived",
          bookingId: null,
          at: "2026-05-21T09:00:00Z",
          source: "booking_audit",
          kind: "completed",
          title: "Visit completed",
          detail: null,
        },
      ],
      bookingLabels: new Map(),
    });

    expect(items[0]?.detail).toContain("Archived booking activity");
    expect(items[0]?.linkable).toBe(true);
    expect(items[1]?.detail).toContain("Archived booking activity");
    expect(items[1]?.linkable).toBe(false);
  });

  it("buildAdminHomePayoutSummaryView distinguishes unavailable from empty queue", () => {
    const unavailable = buildAdminHomePayoutSummaryView(null);
    expect(unavailable.dataAvailable).toBe(false);
    expect(unavailable.weeklyReadyLabel).toContain("unavailable");

    const empty = buildAdminHomePayoutSummaryView({
      pendingCents: 0,
      payoutReadyCents: 0,
      paidCents: 0,
      queue: [],
    });
    expect(empty.dataAvailable).toBe(true);
    expect(empty.weeklyReadyLabel).toBe("Nothing awaiting release");
  });

  it("buildAdminHomeWorkbenchRows caps rows and links to dispatch", () => {
    const rows = buildAdminHomeWorkbenchRows(
      [
        {
          bookingId: "x",
          status: "pending_assignment",
          customerLabel: "Acme",
          serviceLabel: "Deep clean",
          scheduleLabel: "12:30",
          assignmentAttention: "Needs assignment",
          assignmentReason: null,
          openOffers: [],
          queueReason: "No cleaner matched",
          opsSearching: false,
          opsAdminRequired: true,
          recoveryCronCanHandle: false,
          manualInterventionNeeded: true,
          runbookKey: null,
          updatedAt: new Date().toISOString(),
        },
      ],
      queues,
      4,
    );

    expect(rows.length).toBeLessThanOrEqual(4);
    expect(rows[0]?.cta).toBe("Open dispatch");
  });
});
