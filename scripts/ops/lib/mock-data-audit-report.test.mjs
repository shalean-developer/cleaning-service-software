import { describe, expect, it } from "vitest";
import { buildAuditReportPayload } from "./mock-data-audit-report.mjs";

describe("mock-data-audit-report", () => {
  it("builds counts for bookings, customers, and cleaners", () => {
    const audit = {
      profiles: { delete: [], review: [], keep: [{ profileId: "p1" }], orphanDelete: [], all: [] },
      customers: {
        delete: [{ customerId: "c1" }],
        review: [],
        keep: [],
        purged: [],
        all: [{ customerId: "c1", decision: "DELETE" }],
      },
      cleaners: {
        delete: [],
        review: [{ cleanerId: "cl1" }],
        keep: [{ cleanerId: "cl2" }],
        purged: [],
        all: [],
      },
      bookings: {
        delete: [{ bookingId: "b1" }],
        hardDelete: [{ bookingId: "b1" }],
        archive: [],
        blocked: [],
        review: [{ bookingId: "b2" }],
        keep: [],
        all: [],
        deletableIds: ["b1"],
        archiveIds: [],
        deletableCount: 1,
        archiveCount: 0,
        impacts: {},
      },
      impacts: {
        mockProfilesToDelete: 0,
        mockCustomersToDelete: 1,
        mockBookingsToDelete: 1,
        mockBookingsHardDelete: 1,
        mockBookingsArchive: 0,
        mockCleanersToDelete: 0,
        orphanProfilesToDelete: 0,
        paymentsAffected: 0,
        paymentsDeletable: 0,
        earningsAffected: 0,
        earningsBlocked: 0,
        dispatchOffersAffected: 0,
        payoutItemsAffected: 0,
        bookingStateAuditAffected: 0,
        bookingLocksAffected: 0,
        bookingCleanersAffected: 0,
        customerOperationalAuditsAffected: 0,
        notificationsAffected: 0,
        protectedKeepCount: 2,
        reviewCount: 2,
        paidProductionBlockedCount: 0,
        blockedByFinancialOrHistory: { payment: 1 },
      },
      safetyViolations: [],
      scanned: { profiles: 1, customers: 1, cleaners: 2, bookings: 2 },
    };

    const payload = buildAuditReportPayload(audit);
    expect(payload.counts.bookings).toEqual({
      DELETE: 1,
      KEEP: 0,
      REVIEW: 1,
      hardDelete: 1,
      archive: 0,
      blocked: 0,
    });
    expect(payload.counts.customers.DELETE).toBe(1);
    expect(payload.counts.cleaners.REVIEW).toBe(1);
    expect(payload.counts.blocked.payment).toBe(1);
  });
});
