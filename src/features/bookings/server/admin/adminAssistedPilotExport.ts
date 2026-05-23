import "server-only";

import { formatCsvRow } from "@/features/dashboards/server/adminBookingsExport";
import type { AdminAssistedBookingAlert } from "./adminAssistedBookingAlerts";
import type { AdminAssistedPilotQaPanel } from "./loadAdminAssistedPilotQaPanel";

const FORBIDDEN_CSV_SUBSTRINGS = ["sk_live_", "sk_test_", "authorization_code", "access_code"] as const;

function assertSafeCsv(csv: string): void {
  const lower = csv.toLowerCase();
  for (const forbidden of FORBIDDEN_CSV_SUBSTRINGS) {
    if (lower.includes(forbidden.toLowerCase())) {
      throw new Error(`Export contains forbidden field: ${forbidden}`);
    }
  }
}

function bookingAlertFlags(booking: AdminAssistedPilotQaPanel["flaggedBookings"][number]): string[] {
  const flags: string[] = [];
  if (booking.flags.includes("stale_pending_payment")) flags.push("stale_booking");
  if (booking.flags.includes("repeated_link_regenerate")) flags.push("repeated_failures");
  if (booking.flags.includes("failed_notification")) flags.push("payment_anomaly");
  if (
    booking.status === "confirmed" ||
    booking.flags.includes("recurring_materialization_failed")
  ) {
    flags.push("assignment_issue");
  }
  if (
    booking.recurringCadence &&
    booking.recurringCadence !== "once" &&
    !booking.recurringGroupId &&
    booking.status !== "draft" &&
    booking.status !== "pending_payment"
  ) {
    flags.push("recurring_issue");
  }
  return flags;
}

export function buildAdminAssistedPilotExportFilename(now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `admin-assisted-pilot-${stamp}.csv`;
}

export function adminAssistedPilotPanelToCsv(panel: AdminAssistedPilotQaPanel): string {
  const headers = [
    "booking_id",
    "customer",
    "status",
    "pilot_dry_run",
    "payment_path",
    "payment_success",
    "assignment_success",
    "recurring_cadence",
    "recurring_selected_days",
    "recurring_interval_weeks",
    "recurring_materialization_status",
    "recurring_group_id",
    "friction_flags",
    "pending_age_hours",
    "feedback_confusing",
    "feedback_slowed_down",
    "feedback_payment_succeeded",
    "feedback_customer_understood",
    "alert_flags",
    "unresolved_alert_ids",
    "generated_at",
  ];

  const feedbackByBooking = new Map<string, (typeof panel.recentFeedback)[number]>();
  for (const fb of panel.recentFeedback) {
    if (!feedbackByBooking.has(fb.bookingId)) feedbackByBooking.set(fb.bookingId, fb);
  }

  const unresolvedAlertIds = panel.diagnostics.alerts.map((alert) => alert.id);

  const rows = panel.flaggedBookings.map((booking) => {
    const fb = feedbackByBooking.get(booking.bookingId);
    const alertFlags = bookingAlertFlags(booking);
    const paymentPath = booking.flags.includes("offline_payment_used")
      ? "offline"
      : booking.flags.includes("repeated_link_regenerate")
        ? "paystack_link_friction"
        : "paystack_link";
    const paymentSuccess =
      booking.status !== "draft" &&
      booking.status !== "pending_payment" &&
      booking.status !== "payment_failed"
        ? "yes"
        : booking.status === "pending_payment"
          ? "pending"
          : "no";
    const assignmentSuccess =
      booking.status === "assigned" ||
      booking.status === "in_progress" ||
      booking.status === "completed" ||
      booking.status === "pending_assignment"
        ? "yes"
        : "no";

    return formatCsvRow([
      booking.bookingId,
      booking.customerLabel,
      booking.status,
      booking.pilotDryRun ? "yes" : "no",
      paymentPath,
      paymentSuccess,
      assignmentSuccess,
      booking.recurringCadence ?? "",
      booking.recurringSelectedDays ?? "",
      booking.recurringIntervalWeeks != null ? String(booking.recurringIntervalWeeks) : "",
      booking.recurringMaterializationStatus ?? "",
      booking.recurringGroupId ?? "",
      booking.flags.join("|"),
      booking.pendingAgeHours != null ? String(booking.pendingAgeHours) : "",
      fb?.confusingText ?? "",
      fb?.slowedDownText ?? "",
      fb?.paymentSucceeded == null ? "" : String(fb.paymentSucceeded),
      fb?.customerUnderstood == null ? "" : String(fb.customerUnderstood),
      alertFlags.join("|"),
      unresolvedAlertIds.join("|"),
      panel.generatedAt,
    ]);
  });

  const csv = [formatCsvRow(headers), ...rows].join("\n");
  assertSafeCsv(csv);
  return csv;
}

export function adminAssistedPilotPanelToJson(panel: AdminAssistedPilotQaPanel): Record<string, unknown> {
  return {
    ok: true,
    generatedAt: panel.generatedAt,
    friction: panel.friction,
    diagnostics: panel.diagnostics,
    alerts: panel.diagnostics.alerts,
    rolloutStage: panel.diagnostics.rolloutStage,
    unresolvedAlerts: panel.diagnostics.alerts.map((alert: AdminAssistedBookingAlert) => ({
      id: alert.id,
      severity: alert.severity,
      title: alert.title,
      count: alert.count,
    })),
    flaggedBookings: panel.flaggedBookings,
    dryRunBookings: panel.dryRunBookings,
    recentFeedback: panel.recentFeedback.map((fb) => ({
      bookingId: fb.bookingId,
      confusingText: fb.confusingText,
      slowedDownText: fb.slowedDownText,
      paymentSucceeded: fb.paymentSucceeded,
      customerUnderstood: fb.customerUnderstood,
      notes: fb.notes,
      createdAt: fb.createdAt,
    })),
    feedbackCount: panel.feedbackCount,
  };
}
