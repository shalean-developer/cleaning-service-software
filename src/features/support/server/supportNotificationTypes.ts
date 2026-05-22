import type { BookingSupportRequestType } from "@/lib/database/types";
import type { RecurringSeriesRequestType } from "@/lib/database/types";

export const SUPPORT_NOTIFICATION_EVENTS = [
  "support_request_created",
  "support_request_acknowledged",
  "support_request_resolved",
  "support_request_rejected",
  "support_request_admin_urgent",
] as const;

export type SupportNotificationEvent = (typeof SUPPORT_NOTIFICATION_EVENTS)[number];

export type SupportRequestSource = "booking_support" | "recurring_support";

export const SUPPORT_NOTIFICATION_TEMPLATES = {
  customerCreated: "support_request_created",
  customerAcknowledged: "support_request_acknowledged",
  customerResolved: "support_request_resolved",
  customerRejected: "support_request_rejected",
  adminUrgent: "support_request_admin_urgent",
} as const;

export type SupportNotificationTemplate =
  (typeof SUPPORT_NOTIFICATION_TEMPLATES)[keyof typeof SUPPORT_NOTIFICATION_TEMPLATES];

export type SupportNotificationPayload = {
  template: SupportNotificationTemplate;
  event: SupportNotificationEvent;
  dedupeKey: string;
  requestId: string;
  source: SupportRequestSource;
  requestType: BookingSupportRequestType | RecurringSeriesRequestType | string;
  requestStatus: string;
  bookingId: string | null;
  seriesId: string | null;
  groupId: string | null;
  customerId: string;
  userId: string | null;
  customerName: string | null;
  customerContact: string | null;
  messagePreview: string | null;
  customerResponse: string | null;
  ctaPath: string;
  createdAt: string;
  statusChangedAt: string;
  audience: "customer" | "admin";
};

export function buildSupportNotificationDedupeKey(input: {
  source: SupportRequestSource;
  requestId: string;
  status: string;
}): string {
  return `support_request:${input.source}:${input.requestId}:${input.status}`;
}
