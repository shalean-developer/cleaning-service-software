import type { AdminAssistAuditEvent } from "./adminAssistedBookingAnalytics";
import { isAdminAssistPilotDryRun } from "./adminAssistMetadata";
import { parseAdminBookingRecurringScheduleFromMetadata } from "./adminBookingRecurringDisplay";
import type { Json } from "@/lib/database/types";

export type AdminAssistedBookingFrictionMetrics = {
  repeatedLinkRegenerations: number;
  bookingsWithRepeatedRegenerate: number;
  repeatedEmailResends: number;
  bookingsWithRepeatedEmailResend: number;
  longPendingPaymentBookings: number;
  multipleFailedNotificationBookings: number;
  offlinePaymentOverrides: number;
  abandonedDrafts: number;
  highOperatorActionBookings: number;
  missingCustomerEmailBookings: number;
  pilotDryRunBookings: number;
};

export type AdminAssistedBookingFrictionBooking = {
  bookingId: string;
  status: string;
  customerLabel: string;
  flags: string[];
  pendingAgeHours: number | null;
  pilotDryRun: boolean;
  missingCustomerEmail: boolean;
  recurringCadence: string | null;
  recurringSelectedDays: string | null;
  recurringIntervalWeeks: number | null;
  recurringMaterializationStatus: string | null;
  recurringGroupId: string | null;
};

const ABANDONED_DRAFT_HOURS = 48;
const HIGH_OPERATOR_ACTION_THRESHOLD = 6;

type BookingRow = {
  id: string;
  status: string;
  metadata: Json | null;
  updated_at: string;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
};

export function computeAdminAssistedBookingFriction(
  bookings: BookingRow[],
  audits: AdminAssistAuditEvent[],
  options: {
    stalePendingHours: number;
    failedNotificationBookingIds: Set<string>;
    nowMs?: number;
  },
): { metrics: AdminAssistedBookingFrictionMetrics; flaggedBookings: AdminAssistedBookingFrictionBooking[] } {
  const nowMs = options.nowMs ?? Date.now();

  const regenerateByBooking = new Map<string, number>();
  const emailResendByBooking = new Map<string, number>();
  const actionCountByBooking = new Map<string, number>();

  for (const row of audits) {
    if (!row.bookingId) continue;
    actionCountByBooking.set(row.bookingId, (actionCountByBooking.get(row.bookingId) ?? 0) + 1);

    if (row.action === "admin_booking_payment_link_regenerated") {
      regenerateByBooking.set(row.bookingId, (regenerateByBooking.get(row.bookingId) ?? 0) + 1);
    }
    if (row.action === "admin_booking_payment_request_sent") {
      const channel =
        row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>).deliveryChannel
          : null;
      if (channel === "email") {
        emailResendByBooking.set(row.bookingId, (emailResendByBooking.get(row.bookingId) ?? 0) + 1);
      }
    }
  }

  let repeatedLinkRegenerations = 0;
  let bookingsWithRepeatedRegenerate = 0;
  for (const count of regenerateByBooking.values()) {
    if (count > 1) {
      bookingsWithRepeatedRegenerate += 1;
      repeatedLinkRegenerations += count - 1;
    }
  }

  let repeatedEmailResends = 0;
  let bookingsWithRepeatedEmailResend = 0;
  for (const count of emailResendByBooking.values()) {
    if (count > 1) {
      bookingsWithRepeatedEmailResend += 1;
      repeatedEmailResends += count - 1;
    }
  }

  let longPendingPaymentBookings = 0;
  let abandonedDrafts = 0;
  let pilotDryRunBookings = 0;
  let missingCustomerEmailBookings = 0;
  let offlinePaymentOverrides = 0;
  const flaggedBookings: AdminAssistedBookingFrictionBooking[] = [];

  for (const row of bookings) {
    const pilotDryRun = isAdminAssistPilotDryRun(row.metadata);
    if (pilotDryRun) pilotDryRunBookings += 1;

    const missingEmail = !row.customer_email?.trim();
    if (missingEmail) missingCustomerEmailBookings += 1;

  const pendingAgeHours =
      row.status === "pending_payment"
        ? Math.round(((nowMs - Date.parse(row.updated_at)) / 3_600_000) * 10) / 10
        : null;

    if (pendingAgeHours != null && pendingAgeHours >= options.stalePendingHours) {
      longPendingPaymentBookings += 1;
    }

    if (row.status === "draft") {
      const draftAgeHours = (nowMs - Date.parse(row.created_at)) / 3_600_000;
      if (draftAgeHours >= ABANDONED_DRAFT_HOURS) abandonedDrafts += 1;
    }

    const flags: string[] = [];
    if (pilotDryRun) flags.push("pilot_dry_run");
    if (missingEmail) flags.push("missing_customer_email");
    if (pendingAgeHours != null && pendingAgeHours >= options.stalePendingHours) {
      flags.push("stale_pending_payment");
    }
    if ((regenerateByBooking.get(row.id) ?? 0) > 1) flags.push("repeated_link_regenerate");
    if ((emailResendByBooking.get(row.id) ?? 0) > 1) flags.push("repeated_email_resend");
    if (options.failedNotificationBookingIds.has(row.id)) flags.push("failed_notification");
    if ((actionCountByBooking.get(row.id) ?? 0) >= HIGH_OPERATOR_ACTION_THRESHOLD) {
      flags.push("high_operator_actions");
    }
    if (audits.some((a) => a.bookingId === row.id && a.action === "admin_booking_offline_payment_recorded")) {
      offlinePaymentOverrides += 1;
      flags.push("offline_payment_used");
    }
    if (row.status === "draft" && (nowMs - Date.parse(row.created_at)) / 3_600_000 >= ABANDONED_DRAFT_HOURS) {
      flags.push("abandoned_draft");
    }

    if (flags.length > 0) {
      const recurring = parseAdminBookingRecurringScheduleFromMetadata(row.metadata);
      flaggedBookings.push({
        bookingId: row.id,
        status: row.status,
        customerLabel: row.customer_name?.trim() || row.customer_email?.trim() || row.id.slice(0, 8),
        flags,
        pendingAgeHours,
        pilotDryRun,
        missingCustomerEmail: missingEmail,
        recurringCadence: recurring.cadenceLabel,
        recurringSelectedDays: recurring.selectedDaysLabel,
        recurringIntervalWeeks: recurring.intervalWeeks,
        recurringMaterializationStatus: recurring.recurringEnabled
          ? row.status === "draft" || row.status === "pending_payment"
            ? "pending_payment"
            : "unknown"
          : null,
        recurringGroupId: null,
      });
    }
  }

  let multipleFailedNotificationBookings = 0;
  for (const id of options.failedNotificationBookingIds) {
    if (bookings.some((b) => b.id === id)) multipleFailedNotificationBookings += 1;
  }

  let highOperatorActionBookings = 0;
  for (const count of actionCountByBooking.values()) {
    if (count >= HIGH_OPERATOR_ACTION_THRESHOLD) highOperatorActionBookings += 1;
  }

  return {
    metrics: {
      repeatedLinkRegenerations,
      bookingsWithRepeatedRegenerate,
      repeatedEmailResends,
      bookingsWithRepeatedEmailResend,
      longPendingPaymentBookings,
      multipleFailedNotificationBookings,
      offlinePaymentOverrides,
      abandonedDrafts,
      highOperatorActionBookings,
      missingCustomerEmailBookings,
      pilotDryRunBookings,
    },
    flaggedBookings: flaggedBookings.sort((a, b) => b.flags.length - a.flags.length),
  };
}
