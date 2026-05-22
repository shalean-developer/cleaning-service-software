import "server-only";

import { resolveNotificationAppBaseUrl } from "@/lib/app/appBaseUrl";
import { labelForBookingSupportRequestType } from "@/features/bookings/server/bookingSupportRequestTypes";
import type { BookingSupportRequestRow } from "@/lib/database/types";
import type { RecurringSeriesRequestRow } from "@/lib/database/types";
import {
  buildSupportNotificationDedupeKey,
  type SupportNotificationEvent,
  type SupportNotificationPayload,
  type SupportRequestSource,
  SUPPORT_NOTIFICATION_TEMPLATES,
} from "./supportNotificationTypes";

const RECURRING_TYPE_LABELS: Record<string, string> = {
  pause: "Pause",
  cancel: "Cancel",
  reschedule: "Reschedule",
  pause_group: "Pause entire schedule",
  cancel_group: "Cancel entire schedule",
  reschedule_group: "Reschedule entire schedule",
  pause_weekday: "Pause weekday",
  cancel_weekday: "Cancel weekday",
  reschedule_weekday: "Reschedule weekday",
};

function recurringTypeLabel(type: string): string {
  return RECURRING_TYPE_LABELS[type] ?? type;
}

function eventToTemplate(event: SupportNotificationEvent): SupportNotificationPayload["template"] {
  switch (event) {
    case "support_request_created":
      return SUPPORT_NOTIFICATION_TEMPLATES.customerCreated;
    case "support_request_acknowledged":
      return SUPPORT_NOTIFICATION_TEMPLATES.customerAcknowledged;
    case "support_request_resolved":
      return SUPPORT_NOTIFICATION_TEMPLATES.customerResolved;
    case "support_request_rejected":
      return SUPPORT_NOTIFICATION_TEMPLATES.customerRejected;
    case "support_request_admin_urgent":
      return SUPPORT_NOTIFICATION_TEMPLATES.adminUrgent;
    default:
      return SUPPORT_NOTIFICATION_TEMPLATES.customerCreated;
  }
}

function customerCtaPath(input: {
  source: SupportRequestSource;
  bookingId: string | null;
  seriesId: string | null;
  groupId: string | null;
}): string {
  if (input.source === "booking_support" && input.bookingId) {
    return `/customer/bookings/${input.bookingId}#booking-support`;
  }
  if (input.groupId) {
    return `/customer/bookings/recurring/groups/${input.groupId}`;
  }
  if (input.seriesId) {
    return `/customer/bookings/recurring/${input.seriesId}`;
  }
  return "/customer/bookings";
}

export function buildSupportNotificationPayload(input: {
  event: SupportNotificationEvent;
  source: SupportRequestSource;
  request: BookingSupportRequestRow | RecurringSeriesRequestRow;
  statusChangedAt: string;
  customerName?: string | null;
  customerContact?: string | null;
  audience?: "customer" | "admin";
}): SupportNotificationPayload {
  const isBooking = input.source === "booking_support";
  const bookingRow = isBooking ? (input.request as BookingSupportRequestRow) : null;
  const recurringRow = !isBooking ? (input.request as RecurringSeriesRequestRow) : null;

  const requestType = input.request.request_type;
  const requestTypeLabel = isBooking
    ? labelForBookingSupportRequestType(
        requestType as BookingSupportRequestRow["request_type"],
      )
    : recurringTypeLabel(requestType);

  const messagePreview = isBooking
    ? bookingRow!.message
    : recurringRow!.note;

  const ctaPath = customerCtaPath({
    source: input.source,
    bookingId: bookingRow?.booking_id ?? null,
    seriesId: recurringRow?.series_id ?? null,
    groupId: recurringRow?.group_id ?? null,
  });

  return {
    template: eventToTemplate(input.event),
    event: input.event,
    dedupeKey: buildSupportNotificationDedupeKey({
      source: input.source,
      requestId: input.request.id,
      status: input.request.status,
    }),
    requestId: input.request.id,
    source: input.source,
    requestType,
    requestStatus: input.request.status,
    bookingId: bookingRow?.booking_id ?? null,
    seriesId: recurringRow?.series_id ?? null,
    groupId: recurringRow?.group_id ?? null,
    customerId: input.request.customer_id,
    userId: isBooking ? bookingRow!.user_id : null,
    customerName: input.customerName ?? null,
    customerContact: input.customerContact ?? null,
    messagePreview,
    customerResponse:
      "customer_response" in input.request
        ? ((input.request as { customer_response?: string | null }).customer_response ?? null)
        : null,
    ctaPath,
    createdAt: input.request.created_at,
    statusChangedAt: input.statusChangedAt,
    audience: input.audience ?? (input.event === "support_request_admin_urgent" ? "admin" : "customer"),
  };
}

export function supportNotificationCtaUrl(ctaPath: string): string {
  const base = resolveNotificationAppBaseUrl().replace(/\/$/, "");
  return `${base}${ctaPath.startsWith("/") ? ctaPath : `/${ctaPath}`}`;
}

export function adminSupportInboxUrl(): string {
  return `${resolveNotificationAppBaseUrl().replace(/\/$/, "")}/admin/support`;
}
