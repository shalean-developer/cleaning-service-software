import type { BookingSupportRequestType } from "@/lib/database/types";
import type { RecurringSeriesRequestType } from "@/lib/database/types";
import type { SupportNotificationEvent } from "./supportNotificationTypes";

export type SupportNotificationEmailContent = {
  subject: string;
  html: string;
  text: string;
};

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

export function buildSupportCustomerNotificationEmail(input: {
  event: Exclude<SupportNotificationEvent, "support_request_admin_urgent">;
  requestTypeLabel: string;
  requestType: BookingSupportRequestType | RecurringSeriesRequestType | string;
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
    `<p>${escapeHtml(bookingSafety)}</p>`,
  ];

  if (disclaimer) {
    htmlParts.push(`<p><em>${escapeHtml(disclaimer)}</em></p>`);
  }
  if (input.customerResponse?.trim()) {
    htmlParts.push(
      `<p><strong>Team note:</strong> ${escapeHtml(input.customerResponse.trim())}</p>`,
    );
  }
  htmlParts.push(`<p><a href="${escapeHtml(input.ctaUrl)}">View your request</a></p>`);

  const subjectByEvent: Record<typeof input.event, string> = {
    support_request_created: "We received your support request",
    support_request_acknowledged: "We're reviewing your support request",
    support_request_resolved: "Your support request was resolved",
    support_request_rejected: "Update on your support request",
  };

  return {
    subject: subjectByEvent[input.event],
    html: htmlParts.join("\n"),
    text: lines.join("\n"),
  };
}

export function buildSupportAdminUrgentAlertEmail(input: {
  reason: string;
  requestTypeLabel: string;
  customerName: string | null;
  messagePreview: string | null;
  adminInboxUrl: string;
}): SupportNotificationEmailContent {
  const subject = `[Support] ${input.reason} — ${input.customerName ?? "Customer"}`;
  const text = [
    input.reason,
    "",
    `Type: ${input.requestTypeLabel}`,
    input.customerName ? `Customer: ${input.customerName}` : null,
    input.messagePreview ? `Message: ${input.messagePreview}` : null,
    "",
    `Open inbox: ${input.adminInboxUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject,
    html: `<p><strong>${escapeHtml(input.reason)}</strong></p>
<p>${escapeHtml(input.requestTypeLabel)}</p>
<p><a href="${escapeHtml(input.adminInboxUrl)}">Open support inbox</a></p>`,
    text,
  };
}

/** Ensures copy never claims booking cancellation/reschedule/refund without mutation. */
export function assertNoMisleadingBookingMutationCopy(text: string): boolean {
  const lower = text.toLowerCase();
  const forbidden = [
    "your booking has been cancelled",
    "your booking has been rescheduled",
    "your booking was cancelled",
    "your booking was rescheduled",
    "refund issued",
    "refund has been issued",
  ];
  return !forbidden.some((phrase) => lower.includes(phrase));
}
