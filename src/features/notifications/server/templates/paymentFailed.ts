import {
  CHECKOUT_EXPIRED_FAILURE_REASON,
  paymentIssuePanelCopy,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import {
  formatScheduleRange,
  parseBookingDisplay,
  serviceLabelFromSlug,
} from "@/features/dashboards/server/parseBookingDisplay";
import type { Json } from "@/lib/database/types";
import { shortBookingReference } from "./paymentConfirmed";

export type PaymentFailedEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export type PaymentFailedBookingSnapshot = {
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

export function subjectForPaymentFailedEmail(
  failureReason: PaymentFailureReason,
): string {
  if (failureReason === CHECKOUT_EXPIRED_FAILURE_REASON) {
    return "Your Shalean payment link expired";
  }
  return "Payment was not completed for your Shalean booking";
}

export function buildPaymentFailedEmail(input: {
  booking: PaymentFailedBookingSnapshot;
  failureReason: PaymentFailureReason;
  canRetry: boolean;
  customerDisplayName: string | null;
  bookingDetailUrl: string;
  supportEmail: string | null;
}): PaymentFailedEmailContent {
  const ref = shortBookingReference(input.booking.id);
  const display = parseBookingDisplay(input.booking.metadata);
  const serviceLabel = display.serviceLabel || serviceLabelFromSlug(display.serviceSlug);
  const scheduleLabel = formatScheduleRange(
    input.booking.scheduled_start,
    input.booking.scheduled_end,
  );
  const issueCopy = paymentIssuePanelCopy(input.failureReason);

  const greetingName = input.customerDisplayName?.trim();
  const greeting = greetingName ? `Hi ${greetingName},` : "Hi,";

  const supportLine = input.supportEmail
    ? `If you need help, contact us at ${input.supportEmail}.`
    : "If you need help, reply to this email or contact Shalean support.";

  const retryLine = input.canRetry
    ? "You can retry payment on the same booking from your booking page."
    : "You can start a new booking from your booking page if you still need a clean.";

  const text = [
    greeting,
    "",
    issueCopy.body,
    "",
    "No cleaner is assigned until payment succeeds.",
    "",
    `Booking reference: ${ref}`,
    `Service: ${serviceLabel}`,
    `When: ${scheduleLabel}`,
    "",
    retryLine,
    "",
    `View your booking: ${input.bookingDetailUrl}`,
    "",
    supportLine,
    "",
    "Thank you for choosing Shalean.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>${escapeHtml(greeting)}</p>
  <p><strong>${escapeHtml(issueCopy.title)}</strong>. ${escapeHtml(issueCopy.body)}</p>
  <p>No cleaner is assigned until payment succeeds.</p>
  <ul>
    <li><strong>Booking reference:</strong> ${escapeHtml(ref)}</li>
    <li><strong>Service:</strong> ${escapeHtml(serviceLabel)}</li>
    <li><strong>When:</strong> ${escapeHtml(scheduleLabel)}</li>
  </ul>
  <p>${escapeHtml(retryLine)}</p>
  <p><a href="${escapeHtml(input.bookingDetailUrl)}">View your booking</a></p>
  <p style="color: #555; font-size: 14px;">${escapeHtml(supportLine)}</p>
  <p style="color: #555; font-size: 14px;">Thank you for choosing Shalean.</p>
</body>
</html>`;

  return {
    subject: subjectForPaymentFailedEmail(input.failureReason),
    html,
    text,
  };
}
