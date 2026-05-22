import type { BookingSupportRequestType } from "@/lib/database/types";
import type { RecurringSeriesRequestType } from "@/lib/database/types";
import type { SupportNotificationEvent } from "./supportNotificationTypes";
import type { SupportRequestSource } from "./supportNotificationTypes";

export type SupportNotificationEmailContent = {
  subject: string;
  html: string;
  text: string;
};

/** Phrases that must never appear in customer support notification copy. */
export const FORBIDDEN_SUPPORT_CUSTOMER_PHRASES = [
  "your booking has been cancelled",
  "your booking has been rescheduled",
  "your booking was cancelled",
  "your booking was rescheduled",
  "refund issued",
  "refund has been issued",
  "admin_notes",
] as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isCancelType(type: string): boolean {
  return type.includes("cancel");
}

function isRescheduleType(type: string): boolean {
  return type.includes("reschedule");
}

function isPaymentHelpType(type: string): boolean {
  return type === "payment_help";
}

/** Type-specific disclaimer — never implies booking was mutated. */
export function supportRequestTypeDisclaimer(requestType: string): string | null {
  if (isRescheduleType(requestType)) {
    return "A reschedule request is not confirmed until our team updates your booking.";
  }
  if (isCancelType(requestType)) {
    return "A cancellation request does not automatically cancel your booking.";
  }
  if (isPaymentHelpType(requestType)) {
    return "Your booking or payment status may still need action.";
  }
  return null;
}

const EVENT_HEADLINE: Record<
  Exclude<SupportNotificationEvent, "support_request_admin_urgent">,
  string
> = {
  support_request_created: "Thanks, we received your request.",
  support_request_acknowledged: "Our team is reviewing your request.",
  support_request_resolved: "Your support request has been resolved.",
  support_request_rejected: "We reviewed your request and could not approve it.",
};

const CUSTOMER_SUBJECT_BY_EVENT: Record<
  Exclude<SupportNotificationEvent, "support_request_admin_urgent">,
  string
> = {
  support_request_created: "We received your Shalean support request",
  support_request_acknowledged: "Your Shalean support request is being reviewed",
  support_request_resolved: "Your Shalean support request has been resolved",
  support_request_rejected: "Update on your Shalean support request",
};

export function buildSupportCustomerNotificationEmail(input: {
  event: Exclude<SupportNotificationEvent, "support_request_admin_urgent">;
  requestTypeLabel: string;
  requestType: BookingSupportRequestType | RecurringSeriesRequestType | string;
  requestStatus: string;
  customerName: string | null;
  messagePreview: string | null;
  customerResponse: string | null;
  ctaUrl: string;
}): SupportNotificationEmailContent {
  const greeting = input.customerName?.trim()
    ? `Hi ${input.customerName.trim()},`
    : "Hi,";
  const headline = EVENT_HEADLINE[input.event];
  const disclaimer = supportRequestTypeDisclaimer(input.requestType);
  const bookingSafety =
    "This update reflects your support request status only — not an automatic change to your booking or schedule.";

  const lines = [
    greeting,
    "",
    headline,
    "",
    `Request: ${input.requestTypeLabel}`,
    `Status: ${input.requestStatus}`,
    bookingSafety,
  ];

  if (disclaimer) {
    lines.push("", disclaimer);
  }

  if (input.messagePreview?.trim()) {
    lines.push("", `Your message: "${input.messagePreview.trim()}"`);
  }

  if (input.customerResponse?.trim()) {
    lines.push("", `Team note: ${input.customerResponse.trim()}`);
  }

  lines.push("", `View your request: ${input.ctaUrl}`);

  const htmlParts = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p><strong>${escapeHtml(headline)}</strong></p>`,
    `<p>Request: ${escapeHtml(input.requestTypeLabel)}</p>`,
    `<p>Status: ${escapeHtml(input.requestStatus)}</p>`,
    `<p>${escapeHtml(bookingSafety)}</p>`,
  ];

  if (disclaimer) {
    htmlParts.push(`<p><em>${escapeHtml(disclaimer)}</em></p>`);
  }
  if (input.messagePreview?.trim()) {
    htmlParts.push(
      `<p>Your message: &quot;${escapeHtml(input.messagePreview.trim())}&quot;</p>`,
    );
  }
  if (input.customerResponse?.trim()) {
    htmlParts.push(
      `<p><strong>Team note:</strong> ${escapeHtml(input.customerResponse.trim())}</p>`,
    );
  }
  htmlParts.push(`<p><a href="${escapeHtml(input.ctaUrl)}">View your request</a></p>`);

  return {
    subject: CUSTOMER_SUBJECT_BY_EVENT[input.event],
    html: htmlParts.join("\n"),
    text: lines.join("\n"),
  };
}

export function buildSupportAdminUrgentAlertEmail(input: {
  reason: string;
  requestSource: SupportRequestSource;
  requestTypeLabel: string;
  requestStatus: string;
  customerName: string | null;
  customerContact: string | null;
  messagePreview: string | null;
  adminInboxUrl: string;
  contextLink: string | null;
}): SupportNotificationEmailContent {
  const sourceLabel =
    input.requestSource === "booking_support" ? "Booking support" : "Recurring support";
  const customerLine = [
    input.customerName?.trim() ? `Customer: ${input.customerName.trim()}` : null,
    input.customerContact?.trim() ? `Contact: ${input.customerContact.trim()}` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  const subject = "Urgent Shalean support request";
  const text = [
    input.reason,
    "",
    `Source: ${sourceLabel}`,
    `Type: ${input.requestTypeLabel}`,
    `Status: ${input.requestStatus}`,
    customerLine || null,
    input.messagePreview?.trim() ? `Message: ${input.messagePreview.trim()}` : null,
    "",
    `Open inbox: ${input.adminInboxUrl}`,
    input.contextLink ? `Context: ${input.contextLink}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const htmlParts = [
    `<p><strong>${escapeHtml(input.reason)}</strong></p>`,
    `<p>Source: ${escapeHtml(sourceLabel)}</p>`,
    `<p>Type: ${escapeHtml(input.requestTypeLabel)}</p>`,
    `<p>Status: ${escapeHtml(input.requestStatus)}</p>`,
  ];
  if (customerLine) {
    htmlParts.push(`<p>${escapeHtml(customerLine)}</p>`);
  }
  if (input.messagePreview?.trim()) {
    htmlParts.push(`<p>Message: ${escapeHtml(input.messagePreview.trim())}</p>`);
  }
  htmlParts.push(`<p><a href="${escapeHtml(input.adminInboxUrl)}">Open support inbox</a></p>`);
  if (input.contextLink) {
    htmlParts.push(`<p><a href="${escapeHtml(input.contextLink)}">View booking/series</a></p>`);
  }

  return {
    subject,
    html: htmlParts.join("\n"),
    text,
  };
}

/** Ensures copy never claims booking cancellation/reschedule/refund without mutation. */
export function assertNoMisleadingBookingMutationCopy(text: string): boolean {
  const lower = text.toLowerCase();
  return !FORBIDDEN_SUPPORT_CUSTOMER_PHRASES.some((phrase) => lower.includes(phrase));
}
