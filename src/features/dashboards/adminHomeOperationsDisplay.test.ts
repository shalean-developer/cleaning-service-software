import { describe, expect, it } from "vitest";
import {
  buildAdminHomeTodaySnapshot,
  buildAdminHomeWorkbenchRows,
  withActiveIssuesCount,
} from "./adminHomeOperationsDisplay";
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
