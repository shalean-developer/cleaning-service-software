import type { Json } from "@/lib/database/types";
import {
  ASSIGNMENT_OFFER_TEMPLATE,
  PAYMENT_CONFIRMED_TEMPLATE,
  PAYMENT_FAILED_TEMPLATE,
  ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE,
} from "./config";

export function readNotificationPayloadString(payload: Json, key: string): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const value = (payload as Record<string, unknown>)[key];
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

/** Matches worker {@link isDeliverableOutboxRow} / SQL deliverable allowlist. */
export function isDeliverableNotificationRow(row: {
  channel: string;
  payload: Json;
}): boolean {
  const template = readNotificationPayloadString(row.payload, "template");
  if (
    template === PAYMENT_CONFIRMED_TEMPLATE ||
    template === PAYMENT_FAILED_TEMPLATE ||
    template === ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE
  ) {
    return row.channel === "email";
  }
  if (template === ASSIGNMENT_OFFER_TEMPLATE) {
    return (
      row.channel === "push" &&
      Boolean(
        readNotificationPayloadString(row.payload, "offerId") &&
          readNotificationPayloadString(row.payload, "bookingId"),
      )
    );
  }
  return false;
}

export function isRetryDue(nextRetryAt: string | null, nowIso: string): boolean {
  if (nextRetryAt == null) return true;
  return nextRetryAt <= nowIso;
}

export function isStaleProcessingRow(
  updatedAt: string,
  now: Date,
  staleMinutes: number,
): boolean {
  const thresholdMs = staleMinutes * 60_000;
  return now.getTime() - new Date(updatedAt).getTime() > thresholdMs;
}

export function isDryRunLastError(lastError: string | null): boolean {
  return lastError != null && lastError.startsWith("dry_run_sent");
}
