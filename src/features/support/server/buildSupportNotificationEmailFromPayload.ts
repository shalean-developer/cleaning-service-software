import { labelForBookingSupportRequestType } from "@/features/bookings/server/bookingSupportRequestTypes";
import type { BookingSupportRequestRow } from "@/lib/database/types";
import {
  adminSupportInboxUrl,
  supportNotificationCtaUrl,
} from "./buildSupportNotificationPayload";
import type { ParsedSupportOutboxPayload } from "./parseSupportOutboxPayload";
import { isAdminUrgentSupportPayload } from "./parseSupportOutboxPayload";
import {
  buildSupportAdminUrgentAlertEmail,
  buildSupportCustomerNotificationEmail,
  type SupportNotificationEmailContent,
} from "./supportNotificationTemplates";
import type { SupportNotificationEvent } from "./supportNotificationTypes";
import {
  isValidSupportNotificationCtaPath,
  isValidSupportNotificationCtaUrl,
} from "./validateSupportNotificationCta";

const RECURRING_TYPE_LABELS: Record<string, string> = {
  pause: "Pause",
  cancel: "Cancel",
  reschedule: "Reschedule",
  pause_group: "Pause entire schedule",
  cancel_group: "Cancel entire schedule",
  reschedule_group: "Reschedule entire schedule",
  pause_weekday: "Pause weekday",
  cancel_weekday: "Cancel weekday",
  reschedule_weekday: "Reschedule weekday",
};

function recurringTypeLabel(type: string): string {
  return RECURRING_TYPE_LABELS[type] ?? type;
}

function requestTypeLabel(payload: ParsedSupportOutboxPayload): string {
  if (payload.source === "booking_support") {
    return labelForBookingSupportRequestType(
      payload.requestType as BookingSupportRequestRow["request_type"],
    );
  }
  return recurringTypeLabel(payload.requestType);
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: "Open",
    acknowledged: "Being reviewed",
    resolved: "Resolved",
    rejected: "Not approved",
  };
  return labels[status] ?? status;
}

function adminUrgencyReason(payload: ParsedSupportOutboxPayload): string {
  if (payload.requestType === "payment_help") return "Payment help requested";
  if (payload.requestType === "cleaner_issue") return "Cleaner issue reported";
  if (payload.requestType === "service_issue") return "Service issue reported";
  return "Urgent support request";
}

function adminContextLink(payload: ParsedSupportOutboxPayload): string | null {
  const base = adminSupportInboxUrl();
  if (payload.bookingId) {
    return `${base}?booking=${encodeURIComponent(payload.bookingId)}`;
  }
  if (payload.seriesId) {
    return `${base}?series=${encodeURIComponent(payload.seriesId)}`;
  }
  if (payload.groupId) {
    return `${base}?group=${encodeURIComponent(payload.groupId)}`;
  }
  return base;
}

function resolveCtaUrl(payload: ParsedSupportOutboxPayload): string | null {
  if (!isValidSupportNotificationCtaPath(payload.ctaPath)) {
    return null;
  }
  const url = supportNotificationCtaUrl(payload.ctaPath);
  return isValidSupportNotificationCtaUrl(url) ? url : null;
}

function fallbackContent(payload: ParsedSupportOutboxPayload): SupportNotificationEmailContent | null {
  if (payload.subject && payload.text) {
    return {
      subject: payload.subject,
      html: payload.html ?? payload.text,
      text: payload.text,
    };
  }
  return null;
}

/**
 * Renders support notification email from outbox payload with safe fallbacks.
 */
export function buildSupportNotificationEmailFromPayload(
  payload: ParsedSupportOutboxPayload,
): SupportNotificationEmailContent | null {
  if (isAdminUrgentSupportPayload(payload)) {
    return buildSupportAdminUrgentAlertEmail({
      reason: adminUrgencyReason(payload),
      requestSource: payload.source,
      requestTypeLabel: requestTypeLabel(payload),
      requestStatus: statusLabel(payload.requestStatus),
      customerName: payload.customerName,
      customerContact: payload.customerContact,
      messagePreview: payload.messagePreview,
      adminInboxUrl: adminSupportInboxUrl(),
      contextLink: adminContextLink(payload),
    });
  }

  const ctaUrl = resolveCtaUrl(payload);
  if (!ctaUrl) {
    return fallbackContent(payload);
  }

  return buildSupportCustomerNotificationEmail({
    event: payload.event as Exclude<SupportNotificationEvent, "support_request_admin_urgent">,
    requestTypeLabel: requestTypeLabel(payload),
    requestType: payload.requestType,
    requestStatus: statusLabel(payload.requestStatus),
    customerName: payload.customerName,
    messagePreview: payload.messagePreview,
    customerResponse: payload.customerResponse,
    ctaUrl,
  });
}
