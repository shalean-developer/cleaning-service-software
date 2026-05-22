import type { Json } from "@/lib/database/types";
import {
  isSupportNotificationTemplate,
  SUPPORT_REQUEST_ADMIN_URGENT_TEMPLATE,
  type SupportNotificationTemplateName,
} from "@/features/notifications/server/config";
import {
  SUPPORT_NOTIFICATION_EVENTS,
  type SupportNotificationEvent,
  type SupportRequestSource,
} from "./supportNotificationTypes";

export type ParsedSupportOutboxPayload = {
  template: SupportNotificationTemplateName;
  event: SupportNotificationEvent;
  dedupeKey: string;
  requestId: string;
  source: SupportRequestSource;
  requestType: string;
  requestStatus: string;
  bookingId: string | null;
  seriesId: string | null;
  groupId: string | null;
  customerId: string;
  customerName: string | null;
  customerContact: string | null;
  messagePreview: string | null;
  customerResponse: string | null;
  ctaPath: string;
  /** Pre-rendered at enqueue — used as fallback when re-render fails. */
  subject?: string;
  html?: string;
  text?: string;
};

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (value == null) return null;
  return typeof value === "string" ? value : null;
}

const VALID_SOURCES = new Set<SupportRequestSource>(["booking_support", "recurring_support"]);

const EVENT_BY_TEMPLATE: Record<SupportNotificationTemplateName, SupportNotificationEvent> = {
  support_request_created: "support_request_created",
  support_request_acknowledged: "support_request_acknowledged",
  support_request_resolved: "support_request_resolved",
  support_request_rejected: "support_request_rejected",
  support_request_admin_urgent: "support_request_admin_urgent",
};

/**
 * Parses support notification outbox payloads from Phase 3 enqueue.
 * Returns null for unsupported shapes without throwing.
 */
export function parseSupportOutboxPayload(payload: Json): ParsedSupportOutboxPayload | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const template = readString(record, "template");
  if (!template || !isSupportNotificationTemplate(template)) {
    return null;
  }

  const dedupeKey = readString(record, "dedupeKey");
  const requestId = readString(record, "requestId");
  const source = readString(record, "source");
  const requestType = readString(record, "requestType");
  const requestStatus = readString(record, "requestStatus");
  const customerId = readString(record, "customerId");
  const ctaPath = readString(record, "ctaPath");

  if (!dedupeKey || !requestId || !source || !VALID_SOURCES.has(source as SupportRequestSource)) {
    return null;
  }
  if (!requestType || !requestStatus || !customerId || !ctaPath) {
    return null;
  }

  const eventRaw = readString(record, "event");
  const eventCandidate = eventRaw ?? EVENT_BY_TEMPLATE[template];
  if (!(SUPPORT_NOTIFICATION_EVENTS as readonly string[]).includes(eventCandidate)) {
    return null;
  }
  const event = eventCandidate as SupportNotificationEvent;

  return {
    template,
    event,
    dedupeKey,
    requestId,
    source: source as SupportRequestSource,
    requestType,
    requestStatus,
    bookingId: readOptionalString(record, "bookingId"),
    seriesId: readOptionalString(record, "seriesId"),
    groupId: readOptionalString(record, "groupId"),
    customerId,
    customerName: readOptionalString(record, "customerName"),
    customerContact: readOptionalString(record, "customerContact"),
    messagePreview: readOptionalString(record, "messagePreview"),
    customerResponse: readOptionalString(record, "customerResponse"),
    ctaPath,
    subject: readOptionalString(record, "subject") ?? undefined,
    html: readOptionalString(record, "html") ?? undefined,
    text: readOptionalString(record, "text") ?? undefined,
  };
}

export function isAdminUrgentSupportPayload(
  payload: ParsedSupportOutboxPayload,
): boolean {
  return payload.template === SUPPORT_REQUEST_ADMIN_URGENT_TEMPLATE;
}
