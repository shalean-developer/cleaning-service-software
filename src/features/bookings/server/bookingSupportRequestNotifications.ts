import "server-only";

import type { BookingSupportRequestType } from "@/lib/database/types";

/** Flip when notification router handles booking support events. */
export const BOOKING_SUPPORT_NOTIFICATIONS_ENABLED = false;

export const BOOKING_SUPPORT_NOTIFICATION_EVENTS = [
  "booking_support_request_created",
  "booking_support_request_acknowledged",
  "booking_support_request_resolved",
] as const;

export type BookingSupportNotificationEvent =
  (typeof BOOKING_SUPPORT_NOTIFICATION_EVENTS)[number];

export type BookingSupportNotificationPayloadInput = {
  requestId: string;
  bookingId: string;
  requestType: BookingSupportRequestType;
};

/** Payload builder for future outbox routing — no send when disabled. */
export function buildBookingSupportNotificationPayload(
  event: BookingSupportNotificationEvent,
  input: BookingSupportNotificationPayloadInput,
): { event: BookingSupportNotificationEvent; payload: Record<string, unknown> } | null {
  if (!BOOKING_SUPPORT_NOTIFICATIONS_ENABLED) {
    return null;
  }

  return {
    event,
    payload: {
      requestId: input.requestId,
      bookingId: input.bookingId,
      requestType: input.requestType,
    },
  };
}
