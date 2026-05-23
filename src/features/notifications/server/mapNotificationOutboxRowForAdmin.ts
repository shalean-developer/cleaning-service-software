import {
  ASSIGNMENT_OFFER_TEMPLATE,
  PAYMENT_CONFIRMED_TEMPLATE,
  PAYMENT_FAILED_TEMPLATE,
  ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE,
} from "./config";
import type { Json, NotificationOutboxRow } from "@/lib/database/types";
import type { AdminNotificationOutboxEntry } from "@/features/dashboards/server/types";
import {
  computeNotificationRequeueEligibility,
  type MapNotificationOutboxForAdminOptions,
} from "./computeNotificationRequeueEligibility";
import { isDeliverableNotificationRow } from "./notificationOutboxDeliverability";

export type { MapNotificationOutboxForAdminOptions };

export const ADMIN_BOOKING_NOTIFICATION_LIMIT = 25;

export type NotificationOutboxAdminRowInput = Pick<
  NotificationOutboxRow,
  | "id"
  | "channel"
  | "recipient"
  | "payload"
  | "status"
  | "attempts"
  | "next_retry_at"
  | "last_error"
  | "created_at"
  | "updated_at"
>;

export type AdminNotificationDryRunMetadata = {
  template: string | null;
  bookingId: string | null;
  offerId: string | null;
  recipientType: string | null;
};

/** Redact email-like substrings; cap length (aligned with worker sanitizeErrorMessage). */
export function sanitizeNotificationLastError(raw: string | null): string | null {
  if (raw == null || !raw.trim()) return null;
  return raw.replace(/\S+@\S+/g, "[redacted]").slice(0, 500);
}

function readPayloadString(payload: Json, key: string): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const value = (payload as Record<string, unknown>)[key];
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

export function deriveNotificationRecipientType(
  template: string | null,
): AdminNotificationOutboxEntry["recipientType"] {
  if (template === ASSIGNMENT_OFFER_TEMPLATE) return "cleaner";
  if (
    template === PAYMENT_CONFIRMED_TEMPLATE ||
    template === PAYMENT_FAILED_TEMPLATE ||
    template === ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE
  ) {
    return "customer";
  }
  return "unknown";
}

/** Parse `dry_run_sent;template=…;bookingId=…` metadata written by the worker. */
export function parseDryRunMetadataFromLastError(
  lastError: string | null,
): AdminNotificationDryRunMetadata | null {
  if (lastError == null || !lastError.startsWith("dry_run_sent")) {
    return null;
  }
  const meta: AdminNotificationDryRunMetadata = {
    template: null,
    bookingId: null,
    offerId: null,
    recipientType: null,
  };
  for (const part of lastError.split(";")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (!value) continue;
    if (key === "template") meta.template = value;
    else if (key === "bookingId") meta.bookingId = value;
    else if (key === "offerId") meta.offerId = value;
    else if (key === "recipientType") meta.recipientType = value;
  }
  return meta;
}

function formatDryRunNote(meta: AdminNotificationDryRunMetadata): string {
  const parts = ["Dry run"];
  if (meta.template) parts.push(meta.template);
  if (meta.recipientType) parts.push(`→ ${meta.recipientType}`);
  return parts.join(" · ");
}

/**
 * Maps an outbox row to a safe admin DTO. Never returns raw payload or recipient email.
 */
export function mapNotificationOutboxRowForAdmin(
  row: NotificationOutboxAdminRowInput,
  options?: MapNotificationOutboxForAdminOptions,
): AdminNotificationOutboxEntry {
  const template = readPayloadString(row.payload, "template");
  const bookingId = readPayloadString(row.payload, "bookingId");
  const offerId = readPayloadString(row.payload, "offerId");
  const sanitizedError = sanitizeNotificationLastError(row.last_error);
  const dryRun = parseDryRunMetadataFromLastError(row.last_error);

  const statusNote =
    dryRun != null
      ? formatDryRunNote(dryRun)
      : sanitizedError;

  const requeue = computeNotificationRequeueEligibility(row, options);

  return {
    id: row.id,
    template: template ?? "unknown",
    status: row.status,
    channel: row.channel,
    recipientType: deriveNotificationRecipientType(template),
    bookingId,
    offerId,
    attemptCount: row.attempts,
    nextRetryAt: row.next_retry_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastError: sanitizedError,
    statusNote,
    isDryRun: dryRun != null,
    dryRun,
    isDeliverable: isDeliverableNotificationRow(row),
    canRequeue: requeue.canRequeue,
    requeueBlockReason: requeue.requeueBlockReason,
  };
}
