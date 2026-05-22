import { formatBookingReferenceLabel } from "@/lib/app/paymentFailedPage";
import { scheduleStartToBookingDate } from "@/features/booking-wizard/bookingWindowConfig";
import { johannesburgCalendarDayKey } from "@/lib/datetime/johannesburgDay";
import { adminBookingListNeedsHighlight } from "@/features/dashboards/adminBookingListDisplay";
import type { AdminBookingListItem } from "@/features/dashboards/server/types";
import type { BookingStatus } from "@/features/bookings/server/types";

export type AdminBookingOpsStatusTone = "blue" | "amber" | "orange" | "slate" | "emerald";

export type AdminBookingOpsCardModel = {
  id: string;
  href: string;
  initials: string;
  serviceTitle: string;
  bookingRef: string;
  customerLine: string;
  primaryStatus: { label: string; tone: AdminBookingOpsStatusTone };
  showRecurringBadge: boolean;
  scheduleWhen: string;
  scheduleTime: string;
  durationLabel: string;
  addressLabel: string;
  priceLabel: string;
  cleanerLabel: string;
  cleanerWarning: boolean;
  alertLabels: string[];
};

function customerInitials(customerLabel: string): string {
  const parts = customerLabel.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function formatAdminBookingOpsReference(bookingId: string): string {
  const ref = formatBookingReferenceLabel(bookingId);
  return `SHL-${ref.slice(0, 4)}`;
}

function formatDurationHours(scheduledStart?: string, scheduledEnd?: string): string {
  if (!scheduledStart || !scheduledEnd) return "Duration -";
  const startMs = new Date(scheduledStart).getTime();
  const endMs = new Date(scheduledEnd).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return "Duration -";
  }
  const hours = (endMs - startMs) / (1000 * 60 * 60);
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `Estimated ${minutes} min`;
  }
  const rounded = Math.round(hours * 2) / 2;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `Estimated ${label} hour${rounded === 1 ? "" : "s"}`;
}

function formatScheduleWhen(scheduledStart?: string): { when: string; time: string } {
  if (!scheduledStart) return { when: "-", time: "-" };
  const dayKey = scheduleStartToBookingDate(scheduledStart);
  const todayKey = johannesburgCalendarDayKey();
  const when = dayKey === todayKey ? "Today" : "Scheduled";
  const time = new Date(scheduledStart).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Johannesburg",
  });
  return { when, time };
}

function opsStatusToneForBooking(status: BookingStatus): AdminBookingOpsStatusTone {
  switch (status) {
    case "in_progress":
      return "blue";
    case "pending_assignment":
      return "orange";
    case "assigned":
      return "slate";
    case "confirmed":
      return "emerald";
    case "payment_failed":
    case "cancelled":
      return "amber";
    default:
      return "slate";
  }
}

/** Primary uppercase status pill for booking operations cards. */
export function labelForAdminBookingOpsStatus(
  booking: Pick<
    AdminBookingListItem,
    | "status"
    | "cleanerLabel"
    | "assignmentVisibilityKey"
    | "assignmentAttention"
    | "deferredDispatch"
  >,
): string {
  if (booking.status === "in_progress") return "In visit";
  if (booking.status === "assigned") {
    if (booking.deferredDispatch?.phase === "ready_for_dispatch") return "En route";
    return "Cleaner assigned";
  }
  const key = booking.assignmentVisibilityKey ?? booking.assignmentAttention;
  if (
    booking.status === "pending_assignment" ||
    key === "finding_cleaner" ||
    key === "offer_sent" ||
    key === "needs_assignment"
  ) {
    return "Matching cleaner";
  }
  if (booking.status === "confirmed") return "Confirmed";
  if (booking.status === "completed" || booking.status === "payout_ready") return "Completed";
  if (booking.status === "paid_out") return "Paid out";
  if (booking.status === "payment_failed") return "Payment failed";
  if (booking.status === "cancelled") return "Cancelled";
  if (booking.status === "pending_payment") return "Awaiting payment";
  return "Scheduled";
}

function deriveAlertLabels(
  booking: AdminBookingListItem,
): string[] {
  const alerts: string[] = [];
  if (booking.deferredDispatch?.phase === "dispatch_overdue") {
    alerts.push("Late arrival risk");
  }
  const key = booking.assignmentVisibilityKey ?? booking.assignmentAttention;
  if (
    !booking.cleanerLabel &&
    (key === "needs_assignment" ||
      key === "finding_cleaner" ||
      key === "max_attempts_admin" ||
      booking.status === "pending_assignment")
  ) {
    alerts.push("No cleaner matched");
  }
  return alerts;
}

export function buildAdminBookingOpsCardModel(
  booking: AdminBookingListItem,
): AdminBookingOpsCardModel {
  const { when, time } = formatScheduleWhen(booking.scheduledStart);
  const area = booking.suburb ?? booking.city ?? "-";
  const serviceTitle = booking.homeSizeSummary
    ? `${booking.serviceLabel} · ${booking.homeSizeSummary}`
    : booking.serviceLabel;
  const unassigned = !booking.cleanerLabel;
  const key = booking.assignmentVisibilityKey ?? booking.assignmentAttention;

  return {
    id: booking.id,
    href: `/admin/bookings/${booking.id}`,
    initials: customerInitials(booking.customerLabel),
    serviceTitle,
    bookingRef: formatAdminBookingOpsReference(booking.id),
    customerLine: `${booking.customerLabel} · ${area}`,
    primaryStatus: {
      label: labelForAdminBookingOpsStatus(booking),
      tone: opsStatusToneForBooking(booking.status),
    },
    showRecurringBadge: booking.isRecurring === true,
    scheduleWhen: when,
    scheduleTime: time,
    durationLabel: formatDurationHours(booking.scheduledStart, booking.scheduledEnd),
    addressLabel: booking.addressLine ?? area,
    priceLabel: booking.priceLabel,
    cleanerLabel: booking.cleanerLabel ?? "Unassigned · match",
    cleanerWarning: unassigned && key !== "dispatch_not_started",
    alertLabels: deriveAlertLabels(booking),
  };
}

export function adminBookingOpsCardNeedsAttention(booking: AdminBookingListItem): boolean {
  return adminBookingListNeedsHighlight(booking) || deriveAlertLabels(booking).length > 0;
}
