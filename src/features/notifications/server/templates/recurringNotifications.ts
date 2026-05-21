import {
  formatScheduleRange,
  parseBookingDisplay,
  serviceLabelFromSlug,
} from "@/features/dashboards/server/parseBookingDisplay";
import type { Json } from "@/lib/database/types";
import type { RecurringNotificationTemplate } from "../recurringNotificationConfig";

export type RecurringNotificationEmailContent = {
  template: RecurringNotificationTemplate;
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

export function buildRecurringPaymentRequiredChildEmail(input: {
  bookingId: string;
  scheduledStart: string;
  scheduledEnd: string;
  metadata: Json | undefined;
  payUrl: string;
  customerDisplayName: string | null;
}): RecurringNotificationEmailContent {
  const display = parseBookingDisplay(input.metadata);
  const serviceLabel = display.serviceLabel || serviceLabelFromSlug(display.serviceSlug);
  const scheduleLabel = formatScheduleRange(input.scheduledStart, input.scheduledEnd);
  const greeting = input.customerDisplayName?.trim()
    ? `Hi ${input.customerDisplayName},`
    : "Hi,";

  const subject = "Your next recurring visit is ready for payment";
  const text = [
    greeting,
    "",
    "Your next recurring visit is ready for payment.",
    "",
    `Service: ${serviceLabel}`,
    `When: ${scheduleLabel}`,
    "",
    "Pay to confirm this visit. Cleaners are assigned after payment.",
    "",
    `Pay now: ${input.payUrl}`,
  ].join("\n");

  const html = `<p>${escapeHtml(greeting)}</p>
<p>Your next recurring visit is ready for payment.</p>
<p><strong>${escapeHtml(serviceLabel)}</strong><br/>${escapeHtml(scheduleLabel)}</p>
<p>Pay to confirm this visit. Cleaners are assigned after payment.</p>
<p><a href="${escapeHtml(input.payUrl)}">Pay now</a></p>`;

  return {
    template: "recurring_payment_required_child",
    subject,
    html,
    text,
  };
}

export function buildRecurringPaymentReminderEmail(input: {
  bookingId: string;
  hoursSinceCreated: number;
  payUrl: string;
}): RecurringNotificationEmailContent {
  const subject = "Reminder: pay to confirm your recurring visit";
  const text = [
    "Your recurring visit is still waiting for payment.",
    "",
    `It has been ${input.hoursSinceCreated} hours since we created this visit.`,
    "Pay to confirm this visit. Cleaners are assigned after payment.",
    "",
    `Pay now: ${input.payUrl}`,
  ].join("\n");

  return {
    template: "recurring_payment_reminder",
    subject,
    html: `<p>Your recurring visit is still waiting for payment (${input.hoursSinceCreated}h).</p>
<p>Pay to confirm this visit. Cleaners are assigned after payment.</p>
<p><a href="${escapeHtml(input.payUrl)}">Pay now</a></p>`,
    text,
  };
}

export function buildRecurringOverdueAdminAlertEmail(input: {
  seriesId: string;
  bookingId: string;
  customerName: string;
  adminSeriesUrl: string;
}): RecurringNotificationEmailContent {
  const subject = `[Admin] Overdue recurring payment — ${input.customerName}`;
  const text = [
    "A recurring child visit is overdue for payment (>48h).",
    "",
    `Customer: ${input.customerName}`,
    `Series: ${input.seriesId}`,
    `Booking: ${input.bookingId}`,
    "",
    `Review: ${input.adminSeriesUrl}`,
  ].join("\n");

  return {
    template: "recurring_overdue_admin_alert",
    subject,
    html: `<p>Overdue recurring payment for <strong>${escapeHtml(input.customerName)}</strong>.</p>
<p><a href="${escapeHtml(input.adminSeriesUrl)}">Open series</a></p>`,
    text,
  };
}

export function buildRecurringCustomerRequestSubmittedEmail(input: {
  requestTypeLabel: string;
  seriesId: string;
}): RecurringNotificationEmailContent {
  const subject = "We received your recurring schedule request";
  const text = [
    `We received your request to ${input.requestTypeLabel.toLowerCase()} your recurring schedule.`,
    "",
    "Our team will review it and confirm before any change is made.",
  ].join("\n");

  return {
    template: "recurring_customer_request_submitted",
    subject,
    html: `<p>We received your request to ${escapeHtml(input.requestTypeLabel.toLowerCase())} your recurring schedule.</p>
<p>Our team will review it and confirm before any change is made.</p>`,
    text,
  };
}

export function buildRecurringAdminRequestResolvedEmail(input: {
  requestTypeLabel: string;
}): RecurringNotificationEmailContent {
  const subject = "Update on your recurring schedule request";
  const text = [
    `We've processed your ${input.requestTypeLabel.toLowerCase()} request for your recurring schedule.`,
    "",
    "If you have questions, contact Shalean support.",
  ].join("\n");

  return {
    template: "recurring_admin_request_resolved",
    subject,
    html: `<p>We&apos;ve processed your ${escapeHtml(input.requestTypeLabel.toLowerCase())} request.</p>`,
    text,
  };
}
