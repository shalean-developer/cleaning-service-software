import type { AdminAssistedBookingAnalytics } from "./adminAssistedBookingAnalytics";
import type { AdminAssistedBookingFrictionBooking, AdminAssistedBookingFrictionMetrics } from "./adminAssistedBookingFriction";

export type AdminAssistedBookingAlertSeverity = "critical" | "high" | "warning" | "info";

export type AdminAssistedBookingAlert = {
  id: string;
  severity: AdminAssistedBookingAlertSeverity;
  title: string;
  message: string;
  count: number;
  escalation: string;
};

export type AdminAssistedBookingAlertCounts = {
  assistedDrafts: number;
  pendingPayment: number;
  awaitingPayment: number;
  paymentLinksActive: number;
  paymentLinksExpired: number;
  stalePendingPayment: number;
  offlinePaymentsRecorded: number;
  offlinePaymentsFinalized: number;
  offlinePaymentsFailed: number;
  confirmedAfterAssistPayment: number;
  failedPaymentRequestNotifications: number;
  assignmentDispatchAttention: number;
  confirmedWithoutAssignmentDispatch: number;
};

export function computeAdminAssistedBookingAlerts(input: {
  counts: AdminAssistedBookingAlertCounts;
  analytics: AdminAssistedBookingAnalytics;
  friction: AdminAssistedBookingFrictionMetrics;
  flaggedBookings?: AdminAssistedBookingFrictionBooking[];
}): AdminAssistedBookingAlert[] {
  const { counts, analytics, friction, flaggedBookings = [] } = input;
  const alerts: AdminAssistedBookingAlert[] = [];

  if (counts.stalePendingPayment > 0) {
    alerts.push({
      id: "stale_pending_payment",
      severity: counts.stalePendingPayment >= 3 ? "high" : "warning",
      title: "Stale pending payments",
      message: `${counts.stalePendingPayment} booking(s) pending payment for more than 72 hours.`,
      count: counts.stalePendingPayment,
      escalation: "Contact customer, regenerate link if needed, or record offline payment after reconciliation.",
    });
  }

  if (counts.failedPaymentRequestNotifications > 0) {
    alerts.push({
      id: "failed_payment_request_email",
      severity:
        friction.multipleFailedNotificationBookings > 0 ||
        counts.failedPaymentRequestNotifications > 1
          ? "critical"
          : "high",
      title: "Failed payment request emails",
      message: `${counts.failedPaymentRequestNotifications} payment request notification(s) failed delivery.`,
      count: counts.failedPaymentRequestNotifications,
      escalation: "Resend from booking detail or copy WhatsApp message. Check notification outbox.",
    });
  }

  if (friction.repeatedLinkRegenerations > 0 || friction.bookingsWithRepeatedRegenerate > 0) {
    alerts.push({
      id: "repeated_link_regenerations",
      severity: "warning",
      title: "Repeated link regenerations",
      message: `${friction.bookingsWithRepeatedRegenerate} booking(s) with repeated link regenerates (${friction.repeatedLinkRegenerations} total).`,
      count: friction.bookingsWithRepeatedRegenerate,
      escalation:
        "Confirm with customer before regenerating — old links may still settle via Paystack after UI expiry.",
    });
  }

  if (counts.assignmentDispatchAttention > 0) {
    alerts.push({
      id: "assignment_dispatch_attention",
      severity: "high",
      title: "Assignment dispatch attention",
      message: `${counts.assignmentDispatchAttention} paid booking(s) in pending_assignment without dispatch.`,
      count: counts.assignmentDispatchAttention,
      escalation: "Review assignment recovery runbook — do not manual-assign without payment confirmation audit.",
    });
  }

  const recurringMaterializationFailures = flaggedBookings.filter((booking) =>
    booking.flags.includes("recurring_materialization_failed"),
  ).length;
  if (recurringMaterializationFailures > 0) {
    alerts.push({
      id: "recurring_materialization_failed",
      severity: "warning",
      title: "Recurring materialization failures",
      message: `${recurringMaterializationFailures} booking(s) may have failed recurring series materialization.`,
      count: recurringMaterializationFailures,
      escalation: "Verify recurring series on /admin/recurring and booking detail recurring panel.",
    });
  }

  if (counts.offlinePaymentsFailed > 0) {
    alerts.push({
      id: "offline_payment_anomaly",
      severity: "warning",
      title: "Offline payment anomalies",
      message: `${counts.offlinePaymentsFailed} offline payment event(s) failed after record attempt.`,
      count: counts.offlinePaymentsFailed,
      escalation: "Review admin_offline_payment_events and assist timeline before retrying.",
    });
  }

  const paidWithoutRecurringGroup = flaggedBookings.filter(
    (booking) =>
      booking.recurringCadence &&
      booking.recurringCadence !== "once" &&
      !booking.recurringGroupId &&
      booking.status !== "draft" &&
      booking.status !== "pending_payment" &&
      booking.status !== "payment_failed",
  ).length;
  if (paidWithoutRecurringGroup > 0) {
    alerts.push({
      id: "paid_without_recurring_group",
      severity: "critical",
      title: "Paid recurring without group",
      message: `${paidWithoutRecurringGroup} paid recurring booking(s) without a materialized group.`,
      count: paidWithoutRecurringGroup,
      escalation: "Check recurring health dashboard and materialization logs.",
    });
  }

  if (counts.confirmedWithoutAssignmentDispatch > 0) {
    alerts.push({
      id: "orphan_confirmed_unassigned",
      severity: "critical",
      title: "Confirmed without assignment dispatch",
      message: `${counts.confirmedWithoutAssignmentDispatch} booking(s) are confirmed but not yet in pending_assignment.`,
      count: counts.confirmedWithoutAssignmentDispatch,
      escalation:
        "Escalate to ops lead — payment is confirmed; assignment dispatch may have failed silently.",
    });
  }

  if (counts.paymentLinksExpired > 0 && counts.pendingPayment > 0) {
    alerts.push({
      id: "expired_links_pending",
      severity: "info",
      title: "Expired payment links (UI)",
      message: `${counts.paymentLinksExpired} booking(s) with expired link metadata while still pending.`,
      count: counts.paymentLinksExpired,
      escalation:
        "Link expiry blocks resend in UI, but late Paystack payment may still finalize. Regenerate only if customer confirms non-payment.",
    });
  }

  if (analytics.linksRegenerated > analytics.linksGenerated * 0.3 && analytics.linksGenerated >= 3) {
    alerts.push({
      id: "high_regenerate_rate",
      severity: "info",
      title: "High link regeneration rate",
      message: "More than 30% of generated links were regenerated in the scanned window.",
      count: analytics.linksRegenerated,
      escalation: "Review customer communication and link expiry SOP with operators.",
    });
  }

  return alerts.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

function severityRank(severity: AdminAssistedBookingAlertSeverity): number {
  switch (severity) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "warning":
      return 2;
    default:
      return 3;
  }
}
