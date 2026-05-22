import {
  formatScheduleRange,
  parseBookingDisplay,
  serviceLabelFromSlug,
} from "@/features/dashboards/server/parseBookingDisplay";
import type { Json } from "@/lib/database/types";

export type PaymentConfirmedEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export type PaymentConfirmedBookingSnapshot = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  metadata: Json;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function shortBookingReference(bookingId: string): string {
  return bookingId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function buildPaymentConfirmedEmail(input: {
  booking: PaymentConfirmedBookingSnapshot;
  customerDisplayName: string | null;
  bookingDetailUrl: string;
  supportEmail: string | null;
}): PaymentConfirmedEmailContent {
  const ref = shortBookingReference(input.booking.id);
  const display = parseBookingDisplay(input.booking.metadata);
  const serviceLabel = display.serviceLabel || serviceLabelFromSlug(display.serviceSlug);
  const scheduleLabel = formatScheduleRange(
    input.booking.scheduled_start,
    input.booking.scheduled_end,
  );

  const greetingName = input.customerDisplayName?.trim();
  const greeting = greetingName ? `Hi ${greetingName},` : "Hi,";

  const supportLine = input.supportEmail
    ? `If you need help, contact us at ${input.supportEmail}.`
    : "If you need help, reply to this email or contact Shalean support.";

  const text = [
    greeting,
    "",
    "Payment confirmed. your Shalean booking is received.",
    "",
    `Booking reference: ${ref}`,
    `Service: ${serviceLabel}`,
    `When: ${scheduleLabel}`,
    "",
    "We will assign a cleaner and keep you updated on your booking.",
    "",
    `View your booking: ${input.bookingDetailUrl}`,
    "",
    supportLine,
    "",
    "Thank you for booking with Shalean.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>${escapeHtml(greeting)}</p>
  <p><strong>Payment confirmed</strong>. your Shalean booking is received.</p>
  <ul>
    <li><strong>Booking reference:</strong> ${escapeHtml(ref)}</li>
    <li><strong>Service:</strong> ${escapeHtml(serviceLabel)}</li>
    <li><strong>When:</strong> ${escapeHtml(scheduleLabel)}</li>
  </ul>
  <p>We will assign a cleaner and keep you updated on your booking.</p>
  <p><a href="${escapeHtml(input.bookingDetailUrl)}">View your booking</a></p>
  <p style="color: #555; font-size: 14px;">${escapeHtml(supportLine)}</p>
  <p style="color: #555; font-size: 14px;">Thank you for booking with Shalean.</p>
</body>
</html>`;

  return {
    subject: "Payment confirmed. your Shalean booking is received",
    html,
    text,
  };
}
