import { describe, expect, it } from "vitest";
import { computeAdminAssistedRolloutHealth } from "./adminAssistedRolloutHealth";
import type { AdminAssistedBookingAlert } from "./adminAssistedBookingAlerts";

const baseInput = {
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
    confirmedAfterAssistPayment: 5,
    failedPaymentRequestNotifications: 0,
    assignmentDispatchAttention: 0,
    confirmedWithoutAssignmentDispatch: 0,
  },
  analytics: {
    linksGenerated: 10,
    linksRegenerated: 1,
    emailsSent: 8,
    whatsappCopied: 2,
    expiredLinks: 0,
    paymentRequestsSentToday: 1,
    conversionRateGeneratedToPaid: 0.6,
    averageDraftToPaidHours: 12,
    averagePendingToConfirmedHours: 6,
  },
  friction: {
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
  },
  readiness: {
    unresolvedBlockers: [],
    productionReady: true,
    criticalProgress: { completed: 11, total: 11, percent: 100 },
  },
};

describe("computeAdminAssistedRolloutHealth", () => {
  it("returns healthy band with no alerts", () => {
    const health = computeAdminAssistedRolloutHealth({ ...baseInput, alerts: [] });
    expect(health.score).toBeGreaterThanOrEqual(85);
    expect(health.band).toBe("healthy");
  });

  it("degrades score for critical alerts", () => {
    const alerts: AdminAssistedBookingAlert[] = [
      {
        id: "orphan_confirmed_unassigned",
        severity: "critical",
        title: "Confirmed without assignment dispatch",
        message: "1 booking",
        count: 1,
        escalation: "Escalate",
      },
    ];
    const health = computeAdminAssistedRolloutHealth({ ...baseInput, alerts });
    expect(health.score).toBeLessThan(85);
    expect(health.band).not.toBe("healthy");
  });
});
