import {
  formatScheduleRange,
  formatZar,
  parseBookingDisplay,
  serviceLabelFromSlug,
} from "@/features/dashboards/server/parseBookingDisplay";
import { SHALEAN_CONTACT } from "@/features/marketing/contact";
import type { Json } from "@/lib/database/types";

export const ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE =
  "admin_assisted_payment_request_sent" as const;

export type AdminAssistedPaymentRequestEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export type AdminAssistedPaymentRequestBookingSnapshot = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  price_cents: number;
  currency: string;
  metadata: Json;
};

export type AdminAssistedPaymentRequestContentInput = {
  booking: AdminAssistedPaymentRequestBookingSnapshot;
  customerDisplayName: string | null;
  paymentUrl: string;
  expiresAt: string;
  supportEmail: string | null;
  optionalMessage?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatExpiryLabel(expiresAt: string): string {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return expiresAt;
  return date.toLocaleString("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Johannesburg",
  });
}

function buildPaymentRequestBody(input: AdminAssistedPaymentRequestContentInput): {
  greeting: string;
  serviceLabel: string;
  scheduleLabel: string;
  amountLabel: string;
  expiryLabel: string;
  supportLine: string;
  optionalMessage: string | null;
} {
  const display = parseBookingDisplay(input.booking.metadata);
  const serviceLabel = display.serviceLabel || serviceLabelFromSlug(display.serviceSlug);
  const scheduleLabel = formatScheduleRange(
    input.booking.scheduled_start,
    input.booking.scheduled_end,
  );
  const amountLabel = formatZar(input.booking.price_cents, input.booking.currency);
  const greetingName = input.customerDisplayName?.trim();
  const greeting = greetingName ? `Hi ${greetingName},` : "Hi,";
  const supportEmail = input.supportEmail?.trim() || SHALEAN_CONTACT.email;
  const supportLine = `If you need help, contact Shalean at ${supportEmail} or ${SHALEAN_CONTACT.phoneDisplay}.`;
  const optionalMessage = input.optionalMessage?.trim() || null;

  return {
    greeting,
    serviceLabel,
    scheduleLabel,
    amountLabel,
    expiryLabel: formatExpiryLabel(input.expiresAt),
    supportLine,
    optionalMessage,
  };
}

export function buildAdminAssistedPaymentRequestEmail(
  input: AdminAssistedPaymentRequestContentInput,
): AdminAssistedPaymentRequestEmailContent {
  const body = buildPaymentRequestBody(input);

  const text = [
    body.greeting,
    "",
    "Please complete payment for your Shalean cleaning booking using the secure Paystack link below.",
    "",
    `Service: ${body.serviceLabel}`,
    `When: ${body.scheduleLabel}`,
    `Amount: ${body.amountLabel}`,
    `Pay here: ${input.paymentUrl}`,
    `Link expires: ${body.expiryLabel}`,
    body.optionalMessage ? "" : null,
    body.optionalMessage ? `Note from Shalean: ${body.optionalMessage}` : null,
    "",
    body.supportLine,
    "",
    "Thank you for choosing Shalean.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>${escapeHtml(body.greeting)}</p>
  <p>Please complete payment for your Shalean cleaning booking using the secure Paystack link below.</p>
  <ul>
    <li><strong>Service:</strong> ${escapeHtml(body.serviceLabel)}</li>
    <li><strong>When:</strong> ${escapeHtml(body.scheduleLabel)}</li>
    <li><strong>Amount:</strong> ${escapeHtml(body.amountLabel)}</li>
    <li><strong>Link expires:</strong> ${escapeHtml(body.expiryLabel)}</li>
  </ul>
  ${body.optionalMessage ? `<p><strong>Note from Shalean:</strong> ${escapeHtml(body.optionalMessage)}</p>` : ""}
  <p><a href="${escapeHtml(input.paymentUrl)}">Pay for your booking</a></p>
  <p style="color: #555; font-size: 14px;">${escapeHtml(body.supportLine)}</p>
  <p style="color: #555; font-size: 14px;">Thank you for choosing Shalean.</p>
</body>
</html>`;

  return {
    subject: "Payment request for your Shalean cleaning booking",
    html,
    text,
  };
}

export function buildAdminAssistedPaymentRequestWhatsAppCopy(
  input: AdminAssistedPaymentRequestContentInput,
): string {
  const body = buildPaymentRequestBody(input);
  const greetingName = input.customerDisplayName?.trim();

  return [
    greetingName ? `Hi ${greetingName},` : "Hi,",
    "",
    "This is Shalean Cleaning Services with a payment request for your booking.",
    "",
    `Service: ${body.serviceLabel}`,
    `When: ${body.scheduleLabel}`,
    `Amount: ${body.amountLabel}`,
    "",
    `Pay securely here: ${input.paymentUrl}`,
    `Link expires: ${body.expiryLabel}`,
    body.optionalMessage ? `\nNote: ${body.optionalMessage}` : "",
    "",
    `Questions? ${SHALEAN_CONTACT.phoneDisplay} · ${SHALEAN_CONTACT.email}`,
  ]
    .filter(Boolean)
    .join("\n");
}
