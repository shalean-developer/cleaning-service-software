import type { Json, NotificationOutboxStatus } from "@/lib/database/types";
import {
  isDeliverableNotificationRow,
  isDryRunLastError,
  readNotificationPayloadString,
} from "./notificationOutboxDeliverability";

type RequeueEligibilityRowInput = {
  status: NotificationOutboxStatus;
  channel: string;
  payload: Json;
  last_error: string | null;
};

export type NotificationRequeueBlockReason =
  | "REQUEUE_ACTIONS_DISABLED"
  | "NOT_FAILED"
  | "UNSUPPORTED_TEMPLATE"
  | "LIVE_ALREADY_SENT"
  | "PROCESSING"
  | "PENDING"
  | "MISSING_BOOKING_ID";

export type MapNotificationOutboxForAdminOptions = {
  /** When true, compute canRequeue for admin surfaces that expose requeue (5E-1a booking detail, 5E-1b-α global). */
  requeueActionsEnabled?: boolean;
};

export function computeNotificationRequeueEligibility(
  row: RequeueEligibilityRowInput,
  options?: MapNotificationOutboxForAdminOptions,
): { canRequeue: boolean; requeueBlockReason?: NotificationRequeueBlockReason } {
  if (!options?.requeueActionsEnabled) {
    return { canRequeue: false, requeueBlockReason: "REQUEUE_ACTIONS_DISABLED" };
  }

  if (row.status === "processing") {
    return { canRequeue: false, requeueBlockReason: "PROCESSING" };
  }
  if (row.status === "pending") {
    return { canRequeue: false, requeueBlockReason: "PENDING" };
  }

  const isDryRunSent = row.status === "sent" && isDryRunLastError(row.last_error);
  const isFailed = row.status === "failed";

  if (!isFailed && !isDryRunSent) {
    if (row.status === "sent") {
      return { canRequeue: false, requeueBlockReason: "LIVE_ALREADY_SENT" };
    }
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
