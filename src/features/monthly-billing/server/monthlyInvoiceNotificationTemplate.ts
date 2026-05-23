import { formatZar, serviceLabelFromSlug } from "@/features/dashboards/server/parseBookingDisplay";
import { SHALEAN_CONTACT } from "@/features/marketing/contact";
import { formatMonthlyInvoiceServiceName } from "./buildZohoMonthlyInvoicePayload";
import { formatBillingMonthLabel } from "./monthlyInvoiceOperationsTypes";

export const MONTHLY_INVOICE_SENT_TEMPLATE = "monthly_invoice_sent" as const;
export const MONTHLY_INVOICE_REMINDER_TEMPLATE = "monthly_invoice_reminder" as const;

export type MonthlyInvoiceVisitSummary = {
  visitDate: string;
  serviceLabel: string;
  amountCents: number;
};

export type MonthlyInvoiceEmailContentInput = {
  customerDisplayName: string | null;
  billingMonth: string;
  invoiceNumber: string;
  totalCents: number;
  currency: string;
  dueDate: string | null;
  paymentUrl: string;
  supportEmail: string | null;
  visitSummaries: MonthlyInvoiceVisitSummary[];
  isReminder?: boolean;
};

export type MonthlyInvoiceEmailContent = {
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

function formatDueDateLabel(dueDate: string | null): string {
  if (!dueDate) return "As per your billing terms";
  const parsed = new Date(`${dueDate}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return dueDate;
  return parsed.toLocaleDateString("en-ZA", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

function buildVisitSummaryLines(visits: MonthlyInvoiceVisitSummary[], currency: string): string[] {
  if (visits.length === 0) return [];
  return visits.map(
    (visit) =>
      `${visit.visitDate} · ${visit.serviceLabel} · ${formatZar(visit.amountCents, currency)}`,
  );
}

export function buildMonthlyInvoiceVisitSummaries(
  items: Array<{ visitDate: string; serviceSlug: string; amountCents: number }>,
): MonthlyInvoiceVisitSummary[] {
  return items.map((item) => ({
    visitDate: item.visitDate,
    serviceLabel:
      formatMonthlyInvoiceServiceName(item.serviceSlug) ||
      serviceLabelFromSlug(item.serviceSlug),
    amountCents: item.amountCents,
  }));
}

export function buildMonthlyInvoiceEmailContent(
  input: MonthlyInvoiceEmailContentInput,
): MonthlyInvoiceEmailContent {
  const billingMonthLabel = formatBillingMonthLabel(input.billingMonth);
  const amountLabel = formatZar(input.totalCents, input.currency);
  const dueDateLabel = formatDueDateLabel(input.dueDate);
  const greetingName = input.customerDisplayName?.trim();
  const greeting = greetingName ? `Hi ${greetingName},` : "Hi,";
  const supportEmail = input.supportEmail?.trim() || SHALEAN_CONTACT.email;
  const supportLine = `If you need help, contact Shalean at ${supportEmail} or ${SHALEAN_CONTACT.phoneDisplay}.`;
  const visitLines = buildVisitSummaryLines(input.visitSummaries, input.currency);

  const subject = input.isReminder
    ? `Reminder: your Shalean monthly cleaning invoice is due`
    : "Your Shalean monthly cleaning invoice is ready";

  const intro = input.isReminder
    ? "This is a friendly reminder about your outstanding Shalean monthly cleaning invoice."
    : "Your consolidated Shalean monthly cleaning invoice is ready.";

  const text = [
    greeting,
    "",
    intro,
    "",
    `Billing month: ${billingMonthLabel}`,
    `Invoice number: ${input.invoiceNumber}`,
    `Total: ${amountLabel}`,
    `Due date: ${dueDateLabel}`,
    "",
    visitLines.length > 0 ? "Visits included:" : null,
    ...visitLines.map((line) => `  • ${line}`),
    visitLines.length > 0 ? "" : null,
    `Pay here: ${input.paymentUrl}`,
    "",
    supportLine,
    "",
    "Thank you for choosing Shalean.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const visitHtml =
    visitLines.length > 0
      ? `<p><strong>Visits included:</strong></p><ul>${visitLines
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join("")}</ul>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>${escapeHtml(greeting)}</p>
  <p>${escapeHtml(intro)}</p>
  <ul>
    <li><strong>Billing month:</strong> ${escapeHtml(billingMonthLabel)}</li>
    <li><strong>Invoice number:</strong> ${escapeHtml(input.invoiceNumber)}</li>
    <li><strong>Total:</strong> ${escapeHtml(amountLabel)}</li>
    <li><strong>Due date:</strong> ${escapeHtml(dueDateLabel)}</li>
  </ul>
  ${visitHtml}
  <p><a href="${escapeHtml(input.paymentUrl)}">Pay your invoice</a></p>
  <p style="color: #555; font-size: 14px;">${escapeHtml(supportLine)}</p>
  <p style="color: #555; font-size: 14px;">Thank you for choosing Shalean.</p>
</body>
</html>`;

  return { subject, html, text };
}
