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
import { EMPTY_ADMIN_BOOKING_OBSERVATION } from "./adminBookingObservationFixtures";

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
    priceCents: 50_000,
    observation: EMPTY_ADMIN_BOOKING_OBSERVATION,
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
    expect(row.displayTitle).toBeNull();
  });

  it("mapAuditRow adds friendly labels for EXPIRE_ASSIGNMENT_OFFER audit", () => {
    const row = mapAuditRow({
      id: 3,
      booking_id: "b1",
      from_status: "pending_assignment",
      to_status: "pending_assignment",
      command: "EXPIRE_ASSIGNMENT_OFFER",
      actor_profile_id: null,
      actor_type: "service",
      reason: null,
      idempotency_key: "cron:expire-offer:offer-2",
      metadata: {
        offerId: "offer-2",
        cleanerId: "cleaner-1",
        expirySource: "cron",
      },
      payload: {},
      created_at: "2026-05-17T10:00:00.000Z",
    });
    expect(row.displayTitle).toBe("Cleaner offer expired");
    expect(row.displayDescription).toContain("before the cleaner accepted");
  });

  it("mapAuditRow adds friendly labels for RECORD_ASSIGNMENT_OFFER_EXPIRED audit", () => {
    const row = mapAuditRow({
      id: 2,
      booking_id: "b1",
      from_status: "pending_assignment",
      to_status: "pending_assignment",
      command: "RECORD_ASSIGNMENT_OFFER_EXPIRED",
      actor_profile_id: null,
      actor_type: "service",
      reason: null,
      idempotency_key: "cron:expire-offer:offer-1",
      metadata: {
        offerId: "offer-1",
        cleanerId: "cleaner-1",
        expirySource: "cron",
      },
      payload: {},
      created_at: "2026-05-17T10:00:00.000Z",
    });
    expect(row.displayTitle).toBe("Cleaner offer expired");
    expect(row.displayDescription).toContain("before the cleaner accepted");
  });

  it("matches payment request visibility filters", () => {
    const awaiting = listItem({
      status: "pending_payment",
      adminAssisted: true,
      paymentRequestState: "awaiting",
    });
    expect(matchesAdminBookingFilter(awaiting, "awaiting_payment")).toBe(true);
    expect(matchesAdminBookingFilter(awaiting, "payment_link_sent")).toBe(false);

    const linkSent = listItem({
      status: "pending_payment",
      adminAssisted: true,
      paymentRequestState: "link_active",
    });
    expect(matchesAdminBookingFilter(linkSent, "payment_link_sent")).toBe(true);

    const expired = listItem({
      status: "pending_payment",
      adminAssisted: true,
      paymentRequestState: "link_expired",
    });
    expect(matchesAdminBookingFilter(expired, "payment_link_expired")).toBe(true);

    const assisted = listItem({ adminAssisted: true, status: "draft" });
    expect(matchesAdminBookingFilter(assisted, "admin_assisted_only")).toBe(true);
    expect(matchesAdminBookingFilter(listItem({ adminAssisted: false }), "admin_assisted_only")).toBe(
      false,
    );

    const paidOffline = listItem({
      status: "confirmed",
      adminAssisted: true,
      adminAssistPaidVia: "offline",
    });
    expect(matchesAdminBookingFilter(paidOffline, "paid_via_offline")).toBe(true);
    expect(matchesAdminBookingFilter(paidOffline, "paid_via_paystack_link")).toBe(false);

    const paidLink = listItem({
      status: "pending_assignment",
      adminAssisted: true,
      adminAssistPaidVia: "paystack_link",
    });
    expect(matchesAdminBookingFilter(paidLink, "paid_via_paystack_link")).toBe(true);
    expect(matchesAdminBookingFilter(paidLink, "paid_via_offline")).toBe(false);
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

  it("matchesAdminBookingFilter supports team support observation filters", () => {
    const teamItem = listItem({
      observation: {
        ...EMPTY_ADMIN_BOOKING_OBSERVATION,
        isTwoCleanerRequest: true,
        operationalLoad: {
          isTwoCleanerRequest: true,
          isShaleanEquipment: true,
          isHeavyIntensity: false,
          operationalLoadScore: 3,
        },
      },
    });
    expect(matchesAdminBookingFilter(teamItem, "two_cleaner_request")).toBe(true);
    expect(matchesAdminBookingFilter(teamItem, "operational_load")).toBe(true);
    expect(matchesAdminBookingFilter(listItem(), "two_cleaner_request")).toBe(false);
  });

  it("matchesAdminBookingFilter supports NF-7B.2 team coordination filters", () => {
    const awaiting = listItem({
      observation: {
        ...EMPTY_ADMIN_BOOKING_OBSERVATION,
        isTwoCleanerRequest: true,
        operationalLoad: {
          isTwoCleanerRequest: true,
          isShaleanEquipment: true,
          isHeavyIntensity: true,
          operationalLoadScore: 4,
        },
        teamSupportOps: {
          supportingCleaner: null,
          teamSupportNotes: null,
          coordinationStatus: null,
        },
        coordinationStatusLabel: "Admin follow-up required",
      },
    });
    expect(matchesAdminBookingFilter(awaiting, "team_awaiting_coordination")).toBe(true);
    expect(matchesAdminBookingFilter(awaiting, "team_high_risk_combo")).toBe(true);
    expect(matchesAdminBookingFilter(awaiting, "high_operational_load")).toBe(true);

    const coordinated = listItem({
      observation: {
        ...awaiting.observation,
        teamSupportOps: {
          supportingCleaner: null,
          teamSupportNotes: "Ops notes",
          coordinationStatus: {
            status: "fully_coordinated",
            recordedAt: "2026-05-18T10:00:00.000Z",
            recordedByProfileId: "admin-1",
          },
        },
        hasTeamSupportNotes: true,
        coordinationStatusLabel: "Fully coordinated",
      },
    });
    expect(matchesAdminBookingFilter(coordinated, "team_fully_coordinated")).toBe(true);
    expect(matchesAdminBookingFilter(coordinated, "team_awaiting_coordination")).toBe(false);
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
