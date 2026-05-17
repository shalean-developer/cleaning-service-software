import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminOperationalOutcome } from "@/features/admin/server/adminOperationalAuditTypes";
import { recordAdminOperationalAudit } from "@/features/admin/server/recordAdminOperationalAudit";
import type { Database } from "@/lib/database/types";

export type NotificationRequeueAuditResultCode =
  | "REQUEUED"
  | "NOT_FOUND"
  | "NOT_ELIGIBLE"
  | "INVALID_STATUS"
  | "UNSUPPORTED_TEMPLATE"
  | "MISSING_BOOKING_ID"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "PERSISTENCE_ERROR"
  | "AUTH_NOT_CONFIGURED";

export function logAdminNotificationRequeue(payload: {
  outboxId: string;
  adminProfileId: string;
  reason: string;
  resultCode: NotificationRequeueAuditResultCode;
  bookingId?: string | null;
  template?: string | null;
  oldStatus?: string | null;
  newStatus?: string | null;
  deliveryDedupeWouldBlock?: boolean;
}): void {
  console.warn(
    JSON.stringify({
      event: "notification_admin_requeue",
      at: new Date().toISOString(),
      outboxId: payload.outboxId,
      adminProfileId: payload.adminProfileId,
      resultCode: payload.resultCode,
      bookingId: payload.bookingId ?? null,
      template: payload.template ?? null,
      oldStatus: payload.oldStatus ?? null,
      newStatus: payload.newStatus ?? null,
      deliveryDedupeWouldBlock: payload.deliveryDedupeWouldBlock ?? null,
    }),
  );
}

function mapResultCodeToOutcome(
  resultCode: NotificationRequeueAuditResultCode,
): AdminOperationalOutcome {
  if (resultCode === "REQUEUED") return "success";
  if (
    resultCode === "NOT_ELIGIBLE" ||
    resultCode === "INVALID_STATUS" ||
    resultCode === "UNSUPPORTED_TEMPLATE" ||
    resultCode === "MISSING_BOOKING_ID" ||
    resultCode === "VALIDATION_ERROR" ||
    resultCode === "NOT_FOUND"
  ) {
    return "rejected";
  }
  return "failed";
}

export function notificationRequeueIdempotencyKey(
  outboxId: string,
  priorStatus: string,
  priorUpdatedAt: string,
): string {
  return `notification_requeue:${outboxId}:${priorStatus}:${priorUpdatedAt}`;
}

export async function auditAdminNotificationRequeue(
  client: SupabaseClient<Database> | null,
  payload: {
    bookingId: string;
    adminProfileId: string;
    reason: string;
    outboxId: string;
    template: string | null;
    offerId?: string | null;
    resultCode: NotificationRequeueAuditResultCode;
    oldStatus?: string | null;
    newStatus?: string | null;
    deliveryDedupeWouldBlock?: boolean;
    priorUpdatedAt?: string | null;
  },
): Promise<void> {
  logAdminNotificationRequeue({
    outboxId: payload.outboxId,
    adminProfileId: payload.adminProfileId,
    reason: payload.reason,
    resultCode: payload.resultCode,
    bookingId: payload.bookingId,
    template: payload.template,
    oldStatus: payload.oldStatus,
    newStatus: payload.newStatus,
    deliveryDedupeWouldBlock: payload.deliveryDedupeWouldBlock,
  });

  const outcome = mapResultCodeToOutcome(payload.resultCode);

  await recordAdminOperationalAudit(client, {
    bookingId: payload.bookingId,
    adminProfileId: payload.adminProfileId,
    action: "notification_requeue",
    outcome,
    reason: payload.reason,
    resultCode: payload.resultCode,
    offerId: payload.offerId ?? null,
    idempotencyKey:
      outcome === "success" && payload.priorUpdatedAt
        ? notificationRequeueIdempotencyKey(
            payload.outboxId,
            payload.oldStatus ?? "failed",
            payload.priorUpdatedAt,
          )
        : null,
    metadata: {
      outboxId: payload.outboxId,
      template: payload.template ?? undefined,
      oldStatus: payload.oldStatus ?? undefined,
      newStatus: payload.newStatus ?? undefined,
      deliveryDedupeWouldBlock: payload.deliveryDedupeWouldBlock,
    },
  });
}
