import { describe, expect, it } from "vitest";
import { computeAdminAssistedBookingAlerts } from "./adminAssistedBookingAlerts";

const emptyAnalytics = {
  linksGenerated: 0,
  linksRegenerated: 0,
  emailsSent: 0,
  whatsappCopied: 0,
  expiredLinks: 0,
  paymentRequestsSentToday: 0,
  conversionRateGeneratedToPaid: null,
  averageDraftToPaidHours: null,
  averagePendingToConfirmedHours: null,
};

const emptyFriction = {
  repeatedLinkRegenerations: 0,
  bookingsWithRepeatedRegenerate: 0,
  repeatedEmailResends: 0,
  bookingsWithRepeatedEmailResend: 0,
  longPendingPaymentBookings: 0,
  multipleFailedNotificationBookings: 0,
  offlinePaymentOverrides: 0,
  abandonedDrafts: 0,
  highOperatorActionBookings: 0,
  missingCustomerEmailBookings: 0,
  pilotDryRunBookings: 0,
};

describe("computeAdminAssistedBookingAlerts", () => {
  it("surfaces stale pending payments as critical", () => {
    const alerts = computeAdminAssistedBookingAlerts({
      counts: {
        assistedDrafts: 0,
        pendingPayment: 2,
        awaitingPayment: 2,
        paymentLinksActive: 0,
        paymentLinksExpired: 0,
        stalePendingPayment: 2,
        offlinePaymentsRecorded: 0,
        offlinePaymentsFinalized: 0,
        offlinePaymentsFailed: 0,
        confirmedAfterAssistPayment: 0,
        failedPaymentRequestNotifications: 0,
        assignmentDispatchAttention: 0,
        confirmedWithoutAssignmentDispatch: 0,
      },
      analytics: emptyAnalytics,
      friction: emptyFriction,
    });

    expect(alerts.some((alert) => alert.id === "stale_pending_payment")).toBe(true);
  });

  it("surfaces orphan confirmed bookings", () => {
    const alerts = computeAdminAssistedBookingAlerts({
      counts: {
        assistedDrafts: 0,
        pendingPayment: 0,
        awaitingPayment: 0,
        paymentLinksActive: 0,
        paymentLinksExpired: 0,
        stalePendingPayment: 0,
        offlinePaymentsRecorded: 0,
        offlinePaymentsFinalized: 0,
        offlinePaymentsFailed: 0,
        confirmedAfterAssistPayment: 1,
        failedPaymentRequestNotifications: 0,
        assignmentDispatchAttention: 0,
        confirmedWithoutAssignmentDispatch: 1,
      },
      analytics: emptyAnalytics,
      friction: emptyFriction,
    });

    expect(alerts.some((alert) => alert.id === "orphan_confirmed_unassigned")).toBe(true);
  });
});
