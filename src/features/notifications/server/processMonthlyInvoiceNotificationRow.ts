import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { listMonthlyInvoiceBatchItems } from "@/features/monthly-billing/server/monthlyInvoiceBatchRepository";
import {
  buildMonthlyInvoiceEmailContent,
  buildMonthlyInvoiceVisitSummaries,
  MONTHLY_INVOICE_REMINDER_TEMPLATE,
  MONTHLY_INVOICE_SENT_TEMPLATE,
} from "@/features/monthly-billing/server/monthlyInvoiceNotificationTemplate";
import type { Database, NotificationOutboxRow } from "@/lib/database/types";
import {
  getNotificationDeliveryConfig,
  isNotificationDryRunProvider,
} from "./config";
import {
  buildDryRunDeliveryPreview,
  markOutboxSentAfterDelivery,
  type DryRunDeliveryPreview,
} from "./dryRunDelivery";
import { markOutboxFailure } from "./markOutboxFailure";
import { resolveCustomerEmail } from "./resolveCustomerEmail";
import type { EmailSender, SendEmailResult } from "./sendEmail";

type RowProcessResult =
  | { outcome: "sent"; dryRunPreview?: DryRunDeliveryPreview }
  | { outcome: "skipped"; dryRunPreview?: DryRunDeliveryPreview }
  | {
      outcome: "failed";
      code: string;
      message: string;
      retryable?: boolean;
    };

function readPayloadString(payload: NotificationOutboxRow["payload"], key: string): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPayloadNumber(payload: NotificationOutboxRow["payload"], key: string): number | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function processMonthlyInvoiceNotificationRow(
  client: SupabaseClient<Database>,
  row: NotificationOutboxRow,
  emailSender: EmailSender,
  now: Date,
): Promise<RowProcessResult> {
  const template = readPayloadString(row.payload, "template");
  const batchId = readPayloadString(row.payload, "batchId");
  const paymentUrl = readPayloadString(row.payload, "paymentUrl");
  const invoiceNumber = readPayloadString(row.payload, "invoiceNumber");
  const billingMonth = readPayloadString(row.payload, "billingMonth");
  const totalCents = readPayloadNumber(row.payload, "totalCents");
  const currency = readPayloadString(row.payload, "currency") ?? "ZAR";
  const dueDate = readPayloadString(row.payload, "dueDate");

  if (
    !batchId ||
    !paymentUrl ||
    !invoiceNumber ||
    !billingMonth ||
    totalCents == null ||
    (template !== MONTHLY_INVOICE_SENT_TEMPLATE && template !== MONTHLY_INVOICE_REMINDER_TEMPLATE)
  ) {
    return {
      outcome: "failed",
      code: "INVALID_PAYLOAD",
      message: "Missing monthly invoice notification fields in payload.",
    };
  }

  const resolved = await resolveCustomerEmail(client, row.recipient);
  if (!resolved.ok) {
    return {
      outcome: "failed",
      code: resolved.code,
      message:
        resolved.code === "NO_EMAIL"
          ? "Customer has no email address."
          : "Customer not found for recipient.",
    };
  }

  const items = await listMonthlyInvoiceBatchItems(batchId, client);
  const visitSummaries = buildMonthlyInvoiceVisitSummaries(items);
  const config = getNotificationDeliveryConfig();
  const content = buildMonthlyInvoiceEmailContent({
    customerDisplayName: resolved.recipient.displayName,
    billingMonth,
    invoiceNumber,
    totalCents,
    currency,
    dueDate,
    paymentUrl,
    supportEmail: config.supportEmail,
    visitSummaries,
    isReminder: template === MONTHLY_INVOICE_REMINDER_TEMPLATE,
  });

  const sendResult: SendEmailResult = await emailSender({
    to: resolved.recipient.email,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (!sendResult.ok) {
    await markOutboxFailure(client, row, sendResult.error, sendResult.retryable, now);
    return { outcome: "failed", code: "SEND_FAILED", message: sendResult.error };
  }

  const deliveryOutcome = await markOutboxSentAfterDelivery(client, row, now);
  const preview = isNotificationDryRunProvider() ? buildDryRunDeliveryPreview(row) : undefined;
  if (deliveryOutcome === "dry_run_preview") {
    return { outcome: "skipped", dryRunPreview: preview };
  }
  return { outcome: "sent", dryRunPreview: preview };
}
