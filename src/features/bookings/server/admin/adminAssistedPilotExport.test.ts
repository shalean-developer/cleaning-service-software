import { describe, expect, it } from "vitest";
import { adminAssistedPilotPanelToCsv } from "./adminAssistedPilotExport";
import type { AdminAssistedPilotQaPanel } from "./loadAdminAssistedPilotQaPanel";

function samplePanel(): AdminAssistedPilotQaPanel {
  return {
    generatedAt: "2099-01-01T00:00:00.000Z",
    readOnly: true,
    diagnostics: {
      generatedAt: "2099-01-01T00:00:00.000Z",
      readOnly: true,
      featureFlags: {
        bookingEnabled: true,
        paymentLinksEnabled: true,
        offlinePaymentsEnabled: false,
      },
      counts: {
        assistedDrafts: 1,
        pendingPayment: 1,
        awaitingPayment: 1,
        paymentLinksActive: 1,
        paymentLinksExpired: 0,
        stalePendingPayment: 0,
        offlinePaymentsRecorded: 0,
        offlinePaymentsFinalized: 0,
        offlinePaymentsFailed: 0,
        confirmedAfterAssistPayment: 2,
        failedPaymentRequestNotifications: 0,
        assignmentDispatchAttention: 0,
        confirmedWithoutAssignmentDispatch: 0,
      },
      alerts: [],
      rolloutStage: "payment_links",
      analytics: {
        linksGenerated: 1,
        linksRegenerated: 0,
        emailsSent: 0,
        whatsappCopied: 0,
        expiredLinks: 0,
        paymentRequestsSentToday: 0,
        conversionRateGeneratedToPaid: null,
        averageDraftToPaidHours: null,
        averagePendingToConfirmedHours: null,
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
        pilotDryRunBookings: 1,
      },
      operatorFeedbackCount: 0,
      scan: { bookingsScanned: 1, capped: false },
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
      pilotDryRunBookings: 1,
    },
    flaggedBookings: [
      {
        bookingId: "22222222-2222-4222-8222-222222222222",
        status: "confirmed",
        customerLabel: "Jane",
        flags: ["pilot_dry_run"],
        pendingAgeHours: null,
        pilotDryRun: true,
        missingCustomerEmail: false,
        recurringCadence: "Weekly",
        recurringSelectedDays: "Mon · Thu",
        recurringIntervalWeeks: 1,
        recurringMaterializationStatus: "succeeded",
        recurringGroupId: "group-abc",
      },
    ],
    dryRunBookings: [],
    recentFeedback: [],
    feedbackCount: 0,
  };
}

describe("adminAssistedPilotExport recurring fields", () => {
  it("includes recurring columns in CSV export", () => {
    const csv = adminAssistedPilotPanelToCsv(samplePanel());

    expect(csv).toContain("recurring_cadence");
    expect(csv).toContain("recurring_selected_days");
    expect(csv).toContain("recurring_interval_weeks");
    expect(csv).toContain("recurring_materialization_status");
    expect(csv).toContain("recurring_group_id");
    expect(csv).toContain("alert_flags");
    expect(csv).toContain("unresolved_alert_ids");
    expect(csv).toContain("Weekly");
    expect(csv).toContain("Mon · Thu");
    expect(csv).toContain("group-abc");
    expect(csv).toContain("succeeded");
  });
});
