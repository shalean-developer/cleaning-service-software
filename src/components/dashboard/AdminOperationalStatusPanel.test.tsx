import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

import { renderToStaticMarkup } from "react-dom/server";
import { buildAdminOperationalStatus } from "@/features/dashboards/server/adminOperationalHelpers";
import { AdminOperationalStatusPanel } from "./AdminOperationalStatusPanel";

const bookingId = "booking-ops-1";

function operationalFrom(
  overrides: Parameters<typeof buildAdminOperationalStatus>[0],
) {
  return buildAdminOperationalStatus(overrides);
}

describe("AdminOperationalStatusPanel", () => {
  it("renders admin-only operational guidance shell", () => {
    const operational = operationalFrom({
      bookingStatus: "confirmed",
      paymentStatus: "paid",
      paymentFailed: false,
      paymentFailureReason: null,
      visibilityKey: null,
      assignmentReason: null,
      dispatchNotStarted: false,
      opsSearching: false,
      opsAdminRequired: false,
      openOfferCount: 0,
      totalOfferCount: 0,
      hasAssignedCleaner: false,
      hasPaidPayment: true,
      openOfferForReplace: null,
      offerStatuses: [],
      lastOfferOutcome: null,
      recoveryEligibility: "not_applicable",
      graceMinutesRemaining: null,
    });

    const html = renderToStaticMarkup(
      <AdminOperationalStatusPanel bookingId={bookingId} operational={operational} />,
    );

    expect(html).toContain("Actions");
    expect(html).toContain("Manual ops");
    expect(html).toContain("Status breakdown");
    expect(html).toContain(operational.paymentState);
  });

  it("shows recover action only when recovery eligibility is eligible", () => {
    const eligible = operationalFrom({
      bookingStatus: "confirmed",
      paymentStatus: "paid",
      paymentFailed: false,
      paymentFailureReason: null,
      visibilityKey: "dispatch_not_started",
      assignmentReason: null,
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

    const ineligible = operationalFrom({
      bookingStatus: "confirmed",
      paymentStatus: "paid",
      paymentFailed: false,
      paymentFailureReason: null,
      visibilityKey: "dispatch_not_started",
      assignmentReason: null,
      dispatchNotStarted: true,
      opsSearching: false,
      opsAdminRequired: false,
      openOfferCount: 0,
      totalOfferCount: 0,
      hasAssignedCleaner: false,
      hasPaidPayment: true,
      openOfferForReplace: null,
      offerStatuses: [],
      lastOfferOutcome: null,
      recoveryEligibility: "grace_period",
      graceMinutesRemaining: 12,
    });

    const eligibleHtml = renderToStaticMarkup(
      <AdminOperationalStatusPanel bookingId={bookingId} operational={eligible} />,
    );
    const ineligibleHtml = renderToStaticMarkup(
      <AdminOperationalStatusPanel bookingId={bookingId} operational={ineligible} />,
    );

    expect(eligibleHtml).toContain("Run assignment recovery");
    expect(ineligibleHtml).not.toContain("Run assignment recovery");
    expect(ineligibleHtml).toContain("Grace -");
  });

  it("shows manual dispatch only when manualDispatchEligible", () => {
    const withDispatch = operationalFrom({
      bookingStatus: "pending_assignment",
      paymentStatus: "paid",
      paymentFailed: false,
      paymentFailureReason: null,
      visibilityKey: "selected_declined_admin",
      assignmentReason: "Declined",
      dispatchNotStarted: false,
      opsSearching: false,
      opsAdminRequired: true,
      openOfferCount: 0,
      totalOfferCount: 1,
      hasAssignedCleaner: false,
      hasPaidPayment: true,
      openOfferForReplace: null,
      offerStatuses: ["declined"],
      lastOfferOutcome: "Declined",
      recoveryEligibility: "not_applicable",
      graceMinutesRemaining: null,
    });

    const withoutDispatch = operationalFrom({
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
        cleanerId: "cleaner-1",
        cleanerName: "Alex",
      },
      offerStatuses: ["offered"],
      lastOfferOutcome: null,
      recoveryEligibility: "not_applicable",
      graceMinutesRemaining: null,
    });

    expect(withDispatch.manualDispatchEligible).toBe(true);
    expect(withoutDispatch.manualDispatchEligible).toBe(false);

    const withHtml = renderToStaticMarkup(
      <AdminOperationalStatusPanel bookingId={bookingId} operational={withDispatch} />,
    );
    const withoutHtml = renderToStaticMarkup(
      <AdminOperationalStatusPanel bookingId={bookingId} operational={withoutDispatch} />,
    );

    expect(withHtml).toContain("Send offer to cleaner");
    expect(withoutHtml).not.toContain("Send offer to cleaner");
    expect(withoutHtml).toContain("Replace open offer");
  });

  it("shows replace open offer only when replaceOfferEligible", () => {
    const withReplace = operationalFrom({
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
        cleanerId: "cleaner-1",
        cleanerName: "Alex",
      },
      offerStatuses: ["offered"],
      lastOfferOutcome: null,
      recoveryEligibility: "not_applicable",
      graceMinutesRemaining: null,
    });

    const withoutReplace = operationalFrom({
      bookingStatus: "pending_assignment",
      paymentStatus: "paid",
      paymentFailed: false,
      paymentFailureReason: null,
      visibilityKey: "needs_assignment",
      assignmentReason: null,
      dispatchNotStarted: false,
      opsSearching: false,
      opsAdminRequired: true,
      openOfferCount: 0,
      totalOfferCount: 0,
      hasAssignedCleaner: false,
      hasPaidPayment: true,
      openOfferForReplace: null,
      offerStatuses: [],
      lastOfferOutcome: null,
      recoveryEligibility: "not_applicable",
      graceMinutesRemaining: null,
    });

    expect(withReplace.replaceOfferEligible).toBe(true);
    expect(withoutReplace.replaceOfferEligible).toBe(false);

    const withHtml = renderToStaticMarkup(
      <AdminOperationalStatusPanel bookingId={bookingId} operational={withReplace} />,
    );
    const withoutHtml = renderToStaticMarkup(
      <AdminOperationalStatusPanel bookingId={bookingId} operational={withoutReplace} />,
    );

    expect(withHtml).toContain("Replace open offer");
    expect(withoutHtml).not.toContain("Replace open offer");
  });
});
