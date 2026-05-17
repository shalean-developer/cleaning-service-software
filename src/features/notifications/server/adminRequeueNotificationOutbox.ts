import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  validateAdminRecoveryReason,
} from "@/features/assignments/server/adminAssignmentRecovery";
import type { Json, NotificationOutboxStatus } from "@/lib/database/types";
import {
  auditAdminNotificationRequeue,
  logAdminNotificationRequeue,
} from "./auditAdminNotificationRequeue";

function logAdminNotificationRequeueMissingBooking(payload: {
  outboxId: string;
  adminProfileId: string;
  reason: string;
  template: string | null;
}): void {
  logAdminNotificationRequeue({
    outboxId: payload.outboxId,
    adminProfileId: payload.adminProfileId,
    reason: payload.reason,
    resultCode: "MISSING_BOOKING_ID",
    template: payload.template,
  });
}
import { computeDeliveryDedupeWouldBlock } from "./computeDeliveryDedupeWouldBlock";
import {
  isDeliverableNotificationRow,
  isDryRunLastError,
  readNotificationPayloadString,
} from "./notificationOutboxDeliverability";

export type AdminNotificationRequeueOutcome =
  | "requeued"
  | "not_eligible"
  | "not_found"
  | "validation_error"
  | "error";

export type AdminNotificationRequeueSuccess = {
  ok: true;
  outcome: "requeued";
  outboxId: string;
  bookingId: string;
  template: string;
  status: "pending";
  deliveryDedupeWouldBlock: boolean;
  message: string;
};

export type AdminNotificationRequeueFailure = {
  ok: false;
  outcome: Exclude<AdminNotificationRequeueOutcome, "requeued">;
  code: string;
  message: string;
  httpStatus: number;
  deliveryDedupeWouldBlock?: boolean;
};

export type AdminNotificationRequeueResult =
  | AdminNotificationRequeueSuccess
  | AdminNotificationRequeueFailure;

type OutboxRow = {
  id: string;
  status: NotificationOutboxStatus;
  channel: string;
  payload: Json;
  attempts: number;
  last_error: string | null;
  updated_at: string;
};

export async function adminRequeueNotificationOutbox(
  user: CurrentUser,
  outboxId: string,
  input: { reason: string },
): Promise<AdminNotificationRequeueResult> {
  if (user.role !== "admin") {
    return {
      ok: false,
      outcome: "not_eligible",
      code: "FORBIDDEN",
      message: "Admins only.",
      httpStatus: 403,
    };
  }

  const reasonCheck = validateAdminRecoveryReason(input.reason);
  if (!reasonCheck.ok) {
    return {
      ok: false,
      outcome: "validation_error",
      code: "VALIDATION_ERROR",
      message: reasonCheck.message,
      httpStatus: 400,
    };
  }

  const client = createServiceRoleClient();
  if (!client) {
    return {
      ok: false,
      outcome: "error",
      code: "AUTH_NOT_CONFIGURED",
      message: "Service role client not configured.",
      httpStatus: 503,
    };
  }

  const trimmedId = outboxId.trim();
  if (!trimmedId) {
    return {
      ok: false,
      outcome: "not_found",
      code: "NOT_FOUND",
      message: "Notification not found.",
      httpStatus: 404,
    };
  }

  const { data: row, error: loadError } = await client
    .from("notification_outbox")
    .select("id, status, channel, payload, attempts, last_error, updated_at")
    .eq("id", trimmedId)
    .maybeSingle();

  if (loadError) {
    return {
      ok: false,
      outcome: "error",
      code: "PERSISTENCE_ERROR",
      message: loadError.message,
      httpStatus: 500,
    };
  }

  if (!row) {
    return {
      ok: false,
      outcome: "not_found",
      code: "NOT_FOUND",
      message: "Notification not found.",
      httpStatus: 404,
    };
  }

  const template = readNotificationPayloadString(row.payload, "template");
  const bookingId = readNotificationPayloadString(row.payload, "bookingId");
  const offerId = readNotificationPayloadString(row.payload, "offerId");

  const auditBase = {
    bookingId: bookingId ?? "",
    adminProfileId: user.profileId,
    reason: reasonCheck.reason,
    outboxId: row.id,
    template,
    offerId,
    oldStatus: row.status,
    priorUpdatedAt: row.updated_at,
  };

  if (!bookingId) {
    logAdminNotificationRequeueMissingBooking({
      outboxId: row.id,
      adminProfileId: user.profileId,
      reason: reasonCheck.reason,
      template,
    });
    return {
      ok: false,
      outcome: "not_eligible",
      code: "MISSING_BOOKING_ID",
      message: "Notification row has no booking id and cannot be requeued.",
      httpStatus: 409,
    };
  }

  const isDryRunSentRequeue =
    row.status === "sent" && isDryRunLastError(row.last_error);
  const isFailedRequeue = row.status === "failed";

  if (!isFailedRequeue && !isDryRunSentRequeue) {
    const resultCode = "INVALID_STATUS";

    await auditAdminNotificationRequeue(client, {
      ...auditBase,
      bookingId,
      resultCode,
    });

    const message =
      row.status === "sent"
        ? "Live sent notifications cannot be requeued. Only dry-run sent rows are eligible."
        : `Only failed or dry-run sent notifications can be requeued (current status: ${row.status}).`;

    return {
      ok: false,
      outcome: "not_eligible",
      code: resultCode,
      message,
      httpStatus: 409,
    };
  }

  if (!isDeliverableNotificationRow(row)) {
    await auditAdminNotificationRequeue(client, {
      ...auditBase,
      bookingId,
      resultCode: "UNSUPPORTED_TEMPLATE",
    });

    return {
      ok: false,
      outcome: "not_eligible",
      code: "UNSUPPORTED_TEMPLATE",
      message: "This template is not supported for delivery and cannot be requeued.",
      httpStatus: 409,
    };
  }

  const deliveryDedupeWouldBlock = await computeDeliveryDedupeWouldBlock(client, {
    template: template!,
    bookingId,
    offerId,
    excludeOutboxId: row.id,
  });

  const nowIso = new Date().toISOString();

  const expectedStatus = isDryRunSentRequeue ? "sent" : "failed";

  const { data: updated, error: updateError } = await client
    .from("notification_outbox")
    .update({
      status: "pending",
      attempts: 0,
      next_retry_at: nowIso,
      last_error: "admin_requeued",
      updated_at: nowIso,
    })
    .eq("id", row.id)
    .eq("status", expectedStatus)
    .select("id, status")
    .maybeSingle();

  if (updateError) {
    await auditAdminNotificationRequeue(client, {
      ...auditBase,
      bookingId,
      resultCode: "PERSISTENCE_ERROR",
      deliveryDedupeWouldBlock,
    });

    return {
      ok: false,
      outcome: "error",
      code: "PERSISTENCE_ERROR",
      message: updateError.message,
      httpStatus: 500,
    };
  }

  if (!updated) {
    await auditAdminNotificationRequeue(client, {
      ...auditBase,
      bookingId,
      resultCode: "CONFLICT",
      deliveryDedupeWouldBlock,
    });

    return {
      ok: false,
      outcome: "not_eligible",
      code: "CONFLICT",
      message: "Notification status changed before requeue could complete. Refresh and try again.",
      httpStatus: 409,
    };
  }

  await auditAdminNotificationRequeue(client, {
    ...auditBase,
    bookingId,
    resultCode: "REQUEUED",
    newStatus: "pending",
    deliveryDedupeWouldBlock,
    dryRunRequeue: isDryRunSentRequeue,
  });

  const dryRunSuffix = isDryRunSentRequeue
    ? " Next processing follows delivery mode (dry-run or Resend)."
    : "";

  return {
    ok: true,
    outcome: "requeued",
    outboxId: row.id,
    bookingId,
    template: template!,
    status: "pending",
    deliveryDedupeWouldBlock,
    message: deliveryDedupeWouldBlock
      ? `Notification requeued. Worker may skip send if delivery dedupe applies — wait for cron.${dryRunSuffix}`
      : `Notification requeued to pending. Worker will process on the next cron run.${dryRunSuffix}`,
  };
}
