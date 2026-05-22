import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getNotificationDeliveryConfig } from "./config";
import { buildSupportNotificationEmailFromPayload } from "@/features/support/server/buildSupportNotificationEmailFromPayload";
import { canDeliverSupportNotification } from "@/features/support/server/canDeliverSupportNotification";
import { parseSupportOutboxPayload } from "@/features/support/server/parseSupportOutboxPayload";
import { isAdminUrgentSupportPayload } from "@/features/support/server/parseSupportOutboxPayload";
import { markOutboxFailure } from "./markOutboxFailure";
import { markOutboxSentAfterDelivery, buildDryRunDeliveryPreview } from "./dryRunDelivery";
import { hasSentSupportNotificationForDedupeKey } from "./hasSentSupportNotificationForDedupeKey";
import { isNotificationDryRunProvider } from "./config";
import type { EmailSender, SendEmailResult } from "./sendEmail";
import type { Database, NotificationOutboxRow } from "@/lib/database/types";
import type { DryRunDeliveryPreview } from "./dryRunDelivery";

export type SupportRowProcessResult =
  | { outcome: "sent"; dryRunPreview?: DryRunDeliveryPreview }
  | { outcome: "skipped"; reason?: string; dryRunPreview?: DryRunDeliveryPreview }
  | { outcome: "failed"; code: string; message: string; retryable?: boolean };

function logSupportDeliverySkip(payload: Record<string, unknown>): void {
  console.warn(
    JSON.stringify({
      event: "support_notification_delivery",
      at: new Date().toISOString(),
      outcome: "skipped",
      ...payload,
    }),
  );
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function markOutboxSent(
  client: SupabaseClient<Database>,
  rowId: string,
  attempts: number,
  nowIso: string,
): Promise<void> {
  const { error } = await client
    .from("notification_outbox")
    .update({
      status: "sent",
      attempts: attempts + 1,
      next_retry_at: null,
      last_error: null,
      updated_at: nowIso,
    })
    .eq("id", rowId);

  if (error) throw new Error(error.message);
}

export async function processSupportNotificationRow(
  client: SupabaseClient<Database>,
  row: NotificationOutboxRow,
  emailSender: EmailSender,
  now: Date,
): Promise<SupportRowProcessResult> {
  const payload = parseSupportOutboxPayload(row.payload);
  if (!payload) {
    return {
      outcome: "failed",
      code: "INVALID_PAYLOAD",
      message: "Unsupported or malformed support notification payload.",
    };
  }

  const deliveryGate = canDeliverSupportNotification(payload);
  if (!deliveryGate.ok) {
    logSupportDeliverySkip({
      reason: deliveryGate.reason,
      template: payload.template,
      requestId: payload.requestId,
      outboxId: row.id,
    });
    return { outcome: "skipped", reason: deliveryGate.reason };
  }

  if (await hasSentSupportNotificationForDedupeKey(client, payload.dedupeKey, row.id)) {
    await markOutboxSent(client, row.id, row.attempts, now.toISOString());
    return { outcome: "skipped", reason: "dedupe_already_sent" };
  }

  const content = buildSupportNotificationEmailFromPayload(payload);
  if (!content) {
    return {
      outcome: "failed",
      code: "INVALID_PAYLOAD",
      message: "Could not render support notification email.",
    };
  }

  let to: string;
  if (isAdminUrgentSupportPayload(payload)) {
    to = getNotificationDeliveryConfig().supportEmail!;
  } else {
    to = row.recipient.trim();
    if (!isValidEmailAddress(to)) {
      return {
        outcome: "failed",
        code: "NO_EMAIL",
        message: "Invalid customer email recipient.",
      };
    }
  }

  const sendResult: SendEmailResult = await emailSender({
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });

  if (!sendResult.ok) {
    await markOutboxFailure(client, row, sendResult.error, sendResult.retryable, now);
    return {
      outcome: "failed",
      code: "SEND_FAILED",
      message: sendResult.error,
      retryable: sendResult.retryable,
    };
  }

  const deliveryOutcome = await markOutboxSentAfterDelivery(client, row, now);
  const preview = isNotificationDryRunProvider() ? buildDryRunDeliveryPreview(row) : undefined;
  if (deliveryOutcome === "dry_run_preview") {
    return { outcome: "skipped", reason: "dry_run_preview", dryRunPreview: preview };
  }
  return { outcome: "sent", dryRunPreview: preview };
}
