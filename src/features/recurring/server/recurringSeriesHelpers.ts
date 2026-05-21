import "server-only";

import type { BookingStatus } from "@/features/bookings/server/types";
import type { BookingSeriesRow, Json, PaymentRow } from "@/lib/database/types";
import { formatScheduleRange, formatZar, parseBookingDisplay } from "@/features/dashboards/server/parseBookingDisplay";
import type { BookingSeriesStatus } from "../types";
import type {
  RecurringSeriesActionsAllowed,
  RecurringSeriesTimelineEntry,
} from "./recurringManagementTypes";

const PAID_BOOKING_STATUSES = new Set<BookingStatus>([
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

const UNPAID_CHILD_STATUSES = new Set<BookingStatus>([
  "pending_payment",
  "draft",
  "payment_failed",
]);

const COMPLETED_STATUSES = new Set<BookingStatus>(["completed", "payout_ready", "paid_out"]);

export function resolveSeriesActionsAllowed(input: {
  status: BookingSeriesStatus;
  nextOccurrencePaymentRequired: boolean;
  nextOccurrenceBookingId: string | null;
  isCustomer: boolean;
}): RecurringSeriesActionsAllowed {
  const active = input.status === "active";
  const paused = input.status === "paused";

  const admin = !input.isCustomer;
  return {
    canPause: admin && active,
    canResume: admin && paused,
    canCancelSeries: admin && (active || paused),
    canSkipNext:
      admin && active && Boolean(input.nextOccurrenceBookingId || input.nextOccurrencePaymentRequired),
    canRescheduleNext: admin && active,
    canPayNextVisit:
      input.isCustomer &&
      active &&
      input.nextOccurrencePaymentRequired &&
      Boolean(input.nextOccurrenceBookingId),
    canRequestPause: input.isCustomer && active,
    canRequestCancel: input.isCustomer && (active || paused),
    canRequestReschedule: input.isCustomer && active,
  };
}

export function isPaymentRequiredStatus(status: BookingStatus): boolean {
  return UNPAID_CHILD_STATUSES.has(status);
}

export function paymentLabelForBooking(
  status: BookingStatus,
  paymentStatus: string | null,
): string {
  if (isPaymentRequiredStatus(status)) return "Payment required";
  if (PAID_BOOKING_STATUSES.has(status)) {
    return paymentStatus === "paid" ? "Paid" : "Confirmed";
  }
  if (status === "cancelled") return "Cancelled";
  return status;
}

type SeriesBookingRow = {
  id: string;
  status: BookingStatus;
  scheduled_start: string;
  scheduled_end: string;
  metadata: Json;
  created_at: string;
};

export function buildSeriesTimeline(input: {
  series: BookingSeriesRow;
  bookings: SeriesBookingRow[];
  paymentsByBookingId: Map<string, PaymentRow | null>;
}): RecurringSeriesTimelineEntry[] {
  const sorted = [...input.bookings].sort((a, b) =>
    a.scheduled_start.localeCompare(b.scheduled_start),
  );

  return sorted.map((b) => {
    const payment = input.paymentsByBookingId.get(b.id) ?? null;
    const meta =
      b.metadata != null && typeof b.metadata === "object" && !Array.isArray(b.metadata)
        ? (b.metadata as Record<string, unknown>)
        : {};
    const recurring = meta.recurring;
    const isGeneratedChild =
      recurring != null &&
      typeof recurring === "object" &&
      !Array.isArray(recurring) &&
      (recurring as Record<string, unknown>).generated === true;

    return {
      bookingId: b.id,
      scheduledStart: b.scheduled_start,
      scheduledEnd: b.scheduled_end,
      status: b.status,
      paymentStatus: payment?.status ?? null,
      isAnchor: b.id === input.series.created_from_booking_id,
      isGeneratedChild,
      scheduleLabel: formatScheduleRange(b.scheduled_start, b.scheduled_end),
      paymentLabel: paymentLabelForBooking(b.status, payment?.status ?? null),
    };
  });
}

export function parseSeriesLocation(templateMetadata: Json): {
  suburb: string | null;
  addressSummary: string;
} {
  const display = parseBookingDisplay(templateMetadata);
  return {
    suburb: display.suburb,
    addressSummary: display.locationSummary,
  };
}

export function findLatestPaymentByBooking(
  payments: PaymentRow[],
): Map<string, PaymentRow | null> {
  const map = new Map<string, PaymentRow | null>();
  for (const p of payments) {
    const existing = map.get(p.booking_id);
    if (!existing || p.updated_at > existing.updated_at) {
      map.set(p.booking_id, p);
    }
  }
  return map;
}

export function lastCompletedVisitAt(
  bookings: Array<{ status: BookingStatus; scheduled_start: string }>,
): string | null {
  const completed = bookings
    .filter((b) => COMPLETED_STATUSES.has(b.status))
    .sort((a, b) => b.scheduled_start.localeCompare(a.scheduled_start));
  return completed[0]?.scheduled_start ?? null;
}

export function formatSeriesPrice(priceCents: number): string {
  return formatZar(priceCents);
}
