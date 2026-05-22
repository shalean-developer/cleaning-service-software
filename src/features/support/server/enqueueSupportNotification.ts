import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";
import { getNotificationDeliveryConfig } from "@/features/notifications/server/config";
import {
  buildSupportAdminUrgentAlertEmail,
  buildSupportCustomerNotificationEmail,
} from "./supportNotificationTemplates";
import {
  adminSupportInboxUrl,
  buildSupportNotificationPayload,
  supportNotificationCtaUrl,
} from "./buildSupportNotificationPayload";
import {
  isSupportAdminAlertsEnabled,
  isSupportRequestNotificationsEnabled,
} from "./supportNotificationConfig";
import type { SupportNotificationEvent, SupportNotificationPayload } from "./supportNotificationTypes";
import type { BookingSupportRequestRow } from "@/lib/database/types";
import type { RecurringSeriesRequestRow } from "@/lib/database/types";
import type { SupportRequestSource } from "./supportNotificationTypes";
import { labelForBookingSupportRequestType } from "@/features/bookings/server/bookingSupportRequestTypes";

function readDedupeKey(payload: Json): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) return null;
  const key = (payload as Record<string, unknown>).dedupeKey;
  return typeof key === "string" ? key : null;
}

async function hasOutboxDedupeKey(
  client: SupabaseClient<Database>,
  dedupeKey: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("notification_outbox")
    .select("id, payload")
    .in("status", ["pending", "processing", "sent"])
    .limit(500);

  if (error) return false;
  for (const row of data ?? []) {
    if (readDedupeKey(row.payload) === dedupeKey) return true;
  }
  return false;
}

function logSupportNotificationDiagnostic(payload: Record<string, unknown>): void {
  console.warn(JSON.stringify({ event: "support_notification", at: new Date().toISOString(), ...payload }));
}

async function insertOutboxRow(
  client: SupabaseClient<Database>,
  input: { channel: string; recipient: string; payload: Json },
): Promise<void> {
  const ts = new Date().toISOString();
  const { error } = await client.from("notification_outbox").insert({
    channel: input.channel,
    recipient: input.recipient,
    payload: input.payload,
    status: "pending",
    attempts: 0,
    next_retry_at: null,
    last_error: null,
    created_at: ts,
    updated_at: ts,
  });
  if (error) throw new Error(error.message);
}

function recurringTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    pause: "Pause",
    cancel: "Cancel",
    reschedule: "Reschedule",
  };
  return labels[type] ?? type;
}

function buildEmailPreview(payload: SupportNotificationPayload): {
  subject: string;
  html: string;
  text: string;
} {
  const requestTypeLabel =
    payload.source === "booking_support"
      ? labelForBookingSupportRequestType(
          payload.requestType as BookingSupportRequestRow["request_type"],
        )
      : recurringTypeLabel(payload.requestType);

  if (payload.event === "support_request_admin_urgent") {
    const contextLink =
      payload.bookingId != null
        ? `${adminSupportInboxUrl()}?booking=${encodeURIComponent(payload.bookingId)}`
        : payload.seriesId != null
          ? `${adminSupportInboxUrl()}?series=${encodeURIComponent(payload.seriesId)}`
          : payload.groupId != null
            ? `${adminSupportInboxUrl()}?group=${encodeURIComponent(payload.groupId)}`
            : null;
    return buildSupportAdminUrgentAlertEmail({
      reason: "Urgent support request",
      requestSource: payload.source,
      requestTypeLabel,
      requestStatus: payload.requestStatus,
      customerName: payload.customerName,
      customerContact: payload.customerContact,
      messagePreview: payload.messagePreview,
      adminInboxUrl: adminSupportInboxUrl(),
      contextLink,
    });
  }

  const statusLabels: Record<string, string> = {
    open: "Open",
    acknowledged: "Being reviewed",
    resolved: "Resolved",
    rejected: "Not approved",
  };

  return buildSupportCustomerNotificationEmail({
    event: payload.event as Exclude<SupportNotificationEvent, "support_request_admin_urgent">,
    requestTypeLabel,
    requestType: payload.requestType,
    requestStatus: statusLabels[payload.requestStatus] ?? payload.requestStatus,
    customerName: payload.customerName,
    messagePreview: payload.messagePreview,
    customerResponse: payload.customerResponse,
    ctaUrl: supportNotificationCtaUrl(payload.ctaPath),
  });
}

/**
 * Enqueue support notification. idempotent, non-blocking for callers (use void).
 * Does not throw to caller; logs diagnostics on failure.
 */
export async function enqueueSupportNotification(
  client: SupabaseClient<Database>,
  input: {
    event: SupportNotificationEvent;
    source: SupportRequestSource;
    request: BookingSupportRequestRow | RecurringSeriesRequestRow;
    statusChangedAt: string;
    recipientEmail: string | null;
    customerName?: string | null;
    customerContact?: string | null;
  },
): Promise<void> {
  const customerEvents: SupportNotificationEvent[] = [
    "support_request_created",
    "support_request_acknowledged",
    "support_request_resolved",
    "support_request_rejected",
  ];

  const isAdminUrgent = input.event === "support_request_admin_urgent";

  if (isAdminUrgent && !isSupportAdminAlertsEnabled()) {
    return;
  }
  if (!isAdminUrgent && !isSupportRequestNotificationsEnabled()) {
    return;
  }

  try {
    const payload = buildSupportNotificationPayload({
      event: input.event,
      source: input.source,
      request: input.request,
      statusChangedAt: input.statusChangedAt,
      customerName: input.customerName,
      customerContact: input.customerContact,
      audience: isAdminUrgent ? "admin" : "customer",
    });

    if (await hasOutboxDedupeKey(client, payload.dedupeKey)) {
      logSupportNotificationDiagnostic({
        outcome: "dedupe_skipped",
        dedupeKey: payload.dedupeKey,
        requestId: payload.requestId,
      });
      return;
    }

    const email = buildEmailPreview(payload);
    const config = getNotificationDeliveryConfig();

    let recipient: string;
    if (isAdminUrgent) {
      recipient = config.supportEmail ?? "admin-support@internal";
      if (!config.supportEmail) {
        logSupportNotificationDiagnostic({
          outcome: "admin_alert_no_support_email",
          requestId: payload.requestId,
        });
      }
    } else {
      if (!input.recipientEmail?.trim()) {
        logSupportNotificationDiagnostic({
          outcome: "skipped_no_recipient",
          requestId: payload.requestId,
          event: input.event,
        });
        return;
      }
      recipient = input.recipientEmail.trim();
    }

    const outboxPayload: Json = {
      ...payload,
      template: payload.template,
      subject: email.subject,
      html: email.html,
      text: email.text,
      bookingId: payload.bookingId ?? undefined,
    };

    await insertOutboxRow(client, {
      channel: "email",
      recipient,
      payload: outboxPayload,
    });

    logSupportNotificationDiagnostic({
      outcome: "enqueued",
      dedupeKey: payload.dedupeKey,
      requestId: payload.requestId,
      event: input.event,
      template: payload.template,
    });

    if (
      !isAdminUrgent &&
      customerEvents.includes(input.event) &&
      shouldEnqueueAdminUrgentOnCreate(input)
    ) {
      await enqueueSupportNotification(client, {
        ...input,
        event: "support_request_admin_urgent",
        recipientEmail: null,
      });
    }
  } catch (err) {
    logSupportNotificationDiagnostic({
      outcome: "enqueue_failed",
      requestId: input.request.id,
      event: input.event,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

function shouldEnqueueAdminUrgentOnCreate(input: {
  event: SupportNotificationEvent;
  request: BookingSupportRequestRow | RecurringSeriesRequestRow;
}): boolean {
  if (input.event !== "support_request_created") return false;
  const type = input.request.request_type;
  return (
    type === "payment_help" ||
    type === "cleaner_issue" ||
    type === "service_issue"
  );
}

export function mapStatusToNotificationEvent(
  nextStatus: string,
): SupportNotificationEvent | null {
  if (nextStatus === "acknowledged") return "support_request_acknowledged";
  if (nextStatus === "resolved") return "support_request_resolved";
  if (nextStatus === "rejected") return "support_request_rejected";
  return null;
}

/** Fire-and-forget wrapper. never blocks status mutation. */
export function voidEnqueueSupportNotification(
  promise: Promise<void>,
): void {
  void promise.catch((err) => {
    logSupportNotificationDiagnostic({
      outcome: "void_enqueue_error",
      message: err instanceof Error ? err.message : String(err),
    });
  });
}
