import type { AdminAssistedBookingFrictionBooking } from "./adminAssistedBookingFriction";
import type { AdminAssistedBookingAlertSeverity } from "./adminAssistedBookingAlerts";

export type AdminAssistedIncidentCategory =
  | "repeated_failures"
  | "link_regeneration_loop"
  | "notification_resend_loop"
  | "recurring_materialization"
  | "assignment_escalation"
  | "offline_reconciliation";

export type AdminAssistedBookingIncident = {
  id: string;
  bookingId: string;
  customerLabel: string;
  category: AdminAssistedIncidentCategory;
  severity: Exclude<AdminAssistedBookingAlertSeverity, "info">;
  title: string;
  guidance: string;
  escalation: string;
  occurrenceCount: number;
};

function incidentFromBooking(
  booking: AdminAssistedBookingFrictionBooking,
  category: AdminAssistedIncidentCategory,
  severity: AdminAssistedBookingIncident["severity"],
  title: string,
  guidance: string,
  escalation: string,
  occurrenceCount: number,
): AdminAssistedBookingIncident {
  return {
    id: `${category}:${booking.bookingId}`,
    bookingId: booking.bookingId,
    customerLabel: booking.customerLabel,
    category,
    severity,
    title,
    guidance,
    escalation,
    occurrenceCount,
  };
}

export function computeAdminAssistedBookingIncidents(
  flaggedBookings: AdminAssistedBookingFrictionBooking[],
): AdminAssistedBookingIncident[] {
  const incidents: AdminAssistedBookingIncident[] = [];

  for (const booking of flaggedBookings) {
    if (booking.flags.includes("repeated_link_regenerate")) {
      incidents.push(
        incidentFromBooking(
          booking,
          "link_regeneration_loop",
          "warning",
          "Repeated payment link regenerations",
          "Confirm with the customer whether payment completed before issuing another link.",
          "Escalate if regenerations exceed two — possible Paystack late-settlement or customer confusion.",
          2,
        ),
      );
    }

    if (booking.flags.includes("repeated_email_resend")) {
      incidents.push(
        incidentFromBooking(
          booking,
          "notification_resend_loop",
          "high",
          "Repeated payment request resends",
          "Verify customer email and notification outbox before resending again.",
          "Check deliverability and spam filters; switch to WhatsApp copy if email keeps failing.",
          2,
        ),
      );
    }

    if (booking.flags.includes("failed_notification")) {
      incidents.push(
        incidentFromBooking(
          booking,
          "repeated_failures",
          "high",
          "Failed payment request notification",
          "Last payment request email failed — use WhatsApp copy or resend after verifying address.",
          "Critical if multiple failures on same booking — escalate to ops lead.",
          1,
        ),
      );
    }

    if (booking.flags.includes("recurring_materialization_failed")) {
      incidents.push(
        incidentFromBooking(
          booking,
          "recurring_materialization",
          "high",
          "Recurring materialization issue",
          "Paid recurring booking may not have a materialized group — verify on recurring dashboard.",
          "Do not manual-assign cleaners until recurring series is confirmed.",
          1,
        ),
      );
    }

    if (
      booking.recurringCadence &&
      booking.recurringCadence !== "once" &&
      !booking.recurringGroupId &&
      booking.status !== "draft" &&
      booking.status !== "pending_payment"
    ) {
      incidents.push(
        incidentFromBooking(
          booking,
          "recurring_materialization",
          "critical",
          "Paid recurring without group",
          "Recurring cadence is set but no group was materialized after payment.",
          "Escalate to engineering if materialization logs show errors.",
          1,
        ),
      );
    }

    if (booking.status === "confirmed") {
      incidents.push(
        incidentFromBooking(
          booking,
          "assignment_escalation",
          "critical",
          "Confirmed without assignment dispatch",
          "Payment is confirmed but booking has not reached pending_assignment.",
          "Verify finalizePaidBooking audit — escalate ops lead before manual intervention.",
          1,
        ),
      );
    }

    if (booking.status === "pending_assignment" && booking.flags.includes("high_operator_actions")) {
      incidents.push(
        incidentFromBooking(
          booking,
          "assignment_escalation",
          "high",
          "Assignment escalation loop",
          "Multiple operator actions without assignment progress — review dispatch queue.",
          "Check recurring materialization and assignment health before further operator actions.",
          3,
        ),
      );
    }

    if (booking.flags.includes("offline_payment_used") && booking.flags.includes("stale_pending_payment")) {
      incidents.push(
        incidentFromBooking(
          booking,
          "offline_reconciliation",
          "warning",
          "Offline reconciliation attention",
          "Offline payment path used on a booking with extended pending state — verify evidence.",
          "Finance must reconcile evidence reference before retrying any payment action.",
          1,
        ),
      );
    }
  }

  const severityRank = (s: AdminAssistedBookingIncident["severity"]) =>
    s === "critical" ? 0 : s === "high" ? 1 : 2;

  return incidents.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}
