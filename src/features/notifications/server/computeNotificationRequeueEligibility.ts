import type { Json, NotificationOutboxStatus } from "@/lib/database/types";
import {
  isDeliverableNotificationRow,
  readNotificationPayloadString,
} from "./notificationOutboxDeliverability";

type RequeueEligibilityRowInput = {
  status: NotificationOutboxStatus;
  channel: string;
  payload: Json;
};

export type NotificationRequeueBlockReason =
  | "NOT_BOOKING_DETAIL_CONTEXT"
  | "NOT_FAILED"
  | "UNSUPPORTED_TEMPLATE"
  | "LIVE_ALREADY_SENT"
  | "PROCESSING"
  | "PENDING"
  | "MISSING_BOOKING_ID";

export type MapNotificationOutboxForAdminOptions = {
  /** When true, compute canRequeue for booking detail UI (5E-1a). */
  bookingDetailContext?: boolean;
};

export function computeNotificationRequeueEligibility(
  row: RequeueEligibilityRowInput,
  options?: MapNotificationOutboxForAdminOptions,
): { canRequeue: boolean; requeueBlockReason?: NotificationRequeueBlockReason } {
  if (!options?.bookingDetailContext) {
    return { canRequeue: false, requeueBlockReason: "NOT_BOOKING_DETAIL_CONTEXT" };
  }

  if (row.status === "sent") {
    return { canRequeue: false, requeueBlockReason: "LIVE_ALREADY_SENT" };
  }
  if (row.status === "processing") {
    return { canRequeue: false, requeueBlockReason: "PROCESSING" };
  }
  if (row.status === "pending") {
    return { canRequeue: false, requeueBlockReason: "PENDING" };
  }
  if (row.status !== "failed") {
    return { canRequeue: false, requeueBlockReason: "NOT_FAILED" };
  }

  if (!isDeliverableNotificationRow(row)) {
    return { canRequeue: false, requeueBlockReason: "UNSUPPORTED_TEMPLATE" };
  }

  const bookingId = readNotificationPayloadString(row.payload, "bookingId");
  if (!bookingId) {
    return { canRequeue: false, requeueBlockReason: "MISSING_BOOKING_ID" };
  }

  return { canRequeue: true };
}
