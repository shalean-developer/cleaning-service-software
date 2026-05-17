import { describe, expect, it } from "vitest";
import {
  buildAdminOperationalStatus,
  computeManualDispatchEligible,
  computeReplaceOfferEligible,
  computeAdminOperationsSummary,
  filterAdminBookings,
  mapAuditRow,
  matchesAdminBookingFilter,
  summarizeAuditMetadata,
} from "./adminOperationalHelpers";
import type { AdminBookingListItem } from "./types";

function listItem(
  overrides: Partial<AdminBookingListItem> = {},
): AdminBookingListItem & { searchText?: string } {
  return {
    id: "booking-1",
    status: "pending_assignment",
    paymentStatus: "paid",
    paymentFailureReason: null,
    customerLabel: "Acme Co",
    cleanerLabel: null,
    serviceLabel: "Deep Cleaning",
    scheduleLabel: "Mon",
    scheduledStart: "2026-05-20T08:00:00.000Z",
    priceLabel: "R500",
    assignmentAttention: "attention_required",
    assignmentVisibilityKey: "needs_assignment",
    dispatchNotStarted: false,
    recoveryEligible: false,
    updatedAt: "2026-05-16T10:00:00.000Z",
    searchText: "booking-1 acme co",
    ...overrides,
  };
}

describe("adminOperationalHelpers", () => {
  it("summarizeAuditMetadata redacts sensitive keys and keeps failure_reason", () => {
    const summary = summarizeAuditMetadata({
      failure_reason: "checkout_expired",
      authorization: "secret-value",
      assignment: { status: "attention_required", path: "selected" },
    });
    expect(summary).toContain("failure_reason=checkout_expired");
    expect(summary).toContain("assignment.status=attention_required");
    expect(summary).not.toContain("secret");
    expect(summary).not.toContain("authorization");
  });

  it("mapAuditRow includes actor, reason, and idempotency key", () => {
    const row = mapAuditRow({
      id: 1,
      booking_id: "b1",
      from_status: "confirmed",
      to_status: "pending_assignment",
      command: "MOVE_TO_PENDING_ASSIGNMENT",
      actor_profile_id: null,
      actor_type: "service",
      reason: "Post-payment assignment dispatch",
      idempotency_key: "assignment:move:b1",
      metadata: {},
      payload: {},
      created_at: "2026-05-16T10:00:00.000Z",
    });
    expect(row.actorType).toBe("service");
    expect(row.reason).toContain("Post-payment");
    expect(row.idempotencyKey).toBe("assignment:move:b1");
  });

  it("filters bookings by payment_failed and search text", () => {
    const items = [
      { ...listItem({ id: "a", status: "payment_failed" }), searchText: "a acme" },
      { ...listItem({ id: "b", status: "confirmed" }), searchText: "b other" },
    ];
    const failed = filterAdminBookings(items, { filter: "payment_failed" });
    expect(failed).toHaveLength(1);
    expect(failed[0]?.id).toBe("a");

    const search = filterAdminBookings(items, { search: "other" });
    expect(search).toHaveLength(1);
    expect(search[0]?.id).toBe("b");
  });

  it("matches dispatch_not_started and recovery_needed filters", () => {
    const dispatch = listItem({
      assignmentVisibilityKey: "dispatch_not_started",
      dispatchNotStarted: true,
    });
    expect(matchesAdminBookingFilter(dispatch, "dispatch_not_started")).toBe(true);
    expect(matchesAdminBookingFilter(dispatch, "recovery_needed")).toBe(true);

    const selected = listItem({ assignmentVisibilityKey: "selected_declined_admin" });
    expect(matchesAdminBookingFilter(selected, "selected_declined")).toBe(true);
    expect(matchesAdminBookingFilter(selected, "max_attempts")).toBe(false);
  });

  it("computeAdminOperationsSummary distinguishes totals from visible slice", () => {
    const bookings = [
      listItem({ status: "payment_failed" }),
      listItem({ recoveryEligible: true, assignmentVisibilityKey: "dispatch_not_started" }),
      listItem(),
    ];
    const summary = computeAdminOperationsSummary({
      bookings,
      assignmentQueueTotal: 7,
      bookingsVisible: 2,
      assignmentQueueVisible: 7,
    });
    expect(summary.paymentIssueTotal).toBe(1);
    expect(summary.recoveryNeededTotal).toBe(1);
    expect(summary.assignmentAttentionTotal).toBe(7);
    expect(summary.bookingsTotal).toBe(3);
    expect(summary.bookingsVisible).toBe(2);
  });

  it("buildAdminOperationalStatus is read-only guidance for payment_failed", () => {
    const status = buildAdminOperationalStatus({
      bookingStatus: "payment_failed",
      paymentStatus: "failed",
      paymentFailed: true,
      paymentFailureReason: "checkout_expired",
      visibilityKey: null,
      assignmentReason: null,
      dispatchNotStarted: false,
      opsSearching: false,
      opsAdminRequired: false,
      openOfferCount: 0,
      totalOfferCount: 0,
      hasAssignedCleaner: false,
      hasPaidPayment: false,
      openOfferForReplace: null,
      offerStatuses: [],
      lastOfferOutcome: null,
      recoveryEligibility: "not_applicable",
      graceMinutesRemaining: null,
    });
    expect(status.nextSuggestedAction).toContain("Customer must retry");
    expect(status.runbookKey).toBe("paymentFailedRetry");
  });

  it("buildAdminOperationalStatus suggests recovery cron when eligible", () => {
    const status = buildAdminOperationalStatus({
      bookingStatus: "confirmed",
      paymentStatus: "paid",
      paymentFailed: false,
      paymentFailureReason: null,
      visibilityKey: "dispatch_not_started",
      assignmentReason: "Paid but dispatch not started",
      dispatchNotStarted: true,
      opsSearching: false,
      opsAdminRequired: true,
      openOfferCount: 0,
      totalOfferCount: 0,
      hasAssignedCleaner: false,
      hasPaidPayment: true,
      openOfferForReplace: null,
      offerStatuses: [],
      lastOfferOutcome: null,
      recoveryEligibility: "eligible",
      graceMinutesRemaining: null,
    });
    expect(status.recoveryCronCanHandle).toBe(true);
    expect(status.nextSuggestedAction).toContain("Recover assignment");
    expect(status.runbookKey).toBe("assignmentRecovery");
  });

  it("computeManualDispatchEligible requires pending_assignment without open offer", () => {
    expect(
      computeManualDispatchEligible({
        bookingStatus: "pending_assignment",
        hasAssignedCleaner: false,
        hasPaidPayment: true,
        manualInterventionNeeded: true,
        openOfferCount: 0,
      }),
    ).toBe(true);
    expect(
      computeManualDispatchEligible({
        bookingStatus: "pending_assignment",
        hasAssignedCleaner: false,
        hasPaidPayment: true,
        manualInterventionNeeded: true,
        openOfferCount: 1,
      }),
    ).toBe(false);
    expect(
      computeManualDispatchEligible({
        bookingStatus: "confirmed",
        hasAssignedCleaner: false,
        hasPaidPayment: true,
        manualInterventionNeeded: true,
        openOfferCount: 0,
      }),
    ).toBe(false);
  });

  it("computeReplaceOfferEligible requires exactly one open offer", () => {
    expect(
      computeReplaceOfferEligible({
        bookingStatus: "pending_assignment",
        hasAssignedCleaner: false,
        hasPaidPayment: true,
        openOfferCount: 1,
      }),
    ).toBe(true);
    expect(
      computeReplaceOfferEligible({
        bookingStatus: "pending_assignment",
        hasAssignedCleaner: false,
        hasPaidPayment: true,
        openOfferCount: 0,
      }),
    ).toBe(false);
  });

  it("buildAdminOperationalStatus enables replace when one open offer", () => {
    const status = buildAdminOperationalStatus({
      bookingStatus: "pending_assignment",
      paymentStatus: "paid",
      paymentFailed: false,
      paymentFailureReason: null,
      visibilityKey: "offer_sent",
      assignmentReason: null,
      dispatchNotStarted: false,
      opsSearching: true,
      opsAdminRequired: false,
      openOfferCount: 1,
      totalOfferCount: 1,
      hasAssignedCleaner: false,
      hasPaidPayment: true,
      openOfferForReplace: {
        offerId: "offer-1",
        cleanerId: "cleaner-a",
        cleanerName: "Alice",
      },
      offerStatuses: ["offered"],
      lastOfferOutcome: null,
      recoveryEligibility: "not_applicable",
      graceMinutesRemaining: null,
    });
    expect(status.replaceOfferEligible).toBe(true);
    expect(status.manualDispatchEligible).toBe(false);
    expect(status.nextSuggestedAction).toContain("Replace open offer");
  });

  it("buildAdminOperationalStatus enables manual dispatch for selected declined", () => {
    const status = buildAdminOperationalStatus({
      bookingStatus: "pending_assignment",
      paymentStatus: "paid",
      paymentFailed: false,
      paymentFailureReason: null,
      visibilityKey: "selected_declined_admin",
      assignmentReason: "Cleaner declined",
      dispatchNotStarted: false,
      opsSearching: false,
      opsAdminRequired: true,
      openOfferCount: 0,
      totalOfferCount: 1,
      hasAssignedCleaner: false,
      hasPaidPayment: true,
      openOfferForReplace: null,
      offerStatuses: ["declined"],
      lastOfferOutcome: "declined",
      recoveryEligibility: "not_applicable",
      graceMinutesRemaining: null,
    });
    expect(status.manualDispatchEligible).toBe(true);
    expect(status.nextSuggestedAction).toContain("Send offer");
  });
});
