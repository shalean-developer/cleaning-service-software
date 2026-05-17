import "server-only";

import {
  ASSIGNMENT_OFFER_TEMPLATE,
  isNotificationDryRunProvider,
  shouldMarkDryRunSent,
} from "./config";
import type { NotificationOutboxRow } from "@/lib/database/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

export type NotificationRecipientType = "customer" | "cleaner";

export type DryRunDeliveryPreview = {
  outboxId: string;
  template: string;
  bookingId: string | null;
  offerId: string | null;
  recipientType: NotificationRecipientType;
};

function readTemplate(payload: NotificationOutboxRow["payload"]): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const template = (payload as Record<string, unknown>).template;
  return typeof template === "string" ? template : null;
}

function readBookingId(payload: NotificationOutboxRow["payload"]): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const bookingId = (payload as Record<string, unknown>).bookingId;
  return typeof bookingId === "string" && bookingId.trim() ? bookingId.trim() : null;
}

function readOfferId(payload: NotificationOutboxRow["payload"]): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const offerId = (payload as Record<string, unknown>).offerId;
  return typeof offerId === "string" && offerId.trim() ? offerId.trim() : null;
}

export function buildDryRunDeliveryPreview(row: NotificationOutboxRow): DryRunDeliveryPreview {
  const template = readTemplate(row.payload) ?? "unknown";
  return {
    outboxId: row.id,
    template,
    bookingId: readBookingId(row.payload),
    offerId: readOfferId(row.payload),
    recipientType: template === ASSIGNMENT_OFFER_TEMPLATE ? "cleaner" : "customer",
  };
}

export function formatDryRunSentMetadata(preview: DryRunDeliveryPreview): string {
  const parts = [
    "dry_run_sent",
    `template=${preview.template}`,
    preview.bookingId ? `bookingId=${preview.bookingId}` : null,
    preview.offerId ? `offerId=${preview.offerId}` : null,
    `recipientType=${preview.recipientType}`,
  ].filter(Boolean);
  return parts.join(";");
}

export async function markOutboxDryRunPreview(
  client: SupabaseClient<Database>,
  rowId: string,
  preview: DryRunDeliveryPreview,
  nowIso: string,
): Promise<void> {
  const { error } = await client
    .from("notification_outbox")
    .update({
      status: "pending",
      last_error: formatDryRunSentMetadata(preview),
      updated_at: nowIso,
    })
    .eq("id", rowId)
    .eq("status", "processing");

  if (error) throw new Error(error.message);
}

export async function markOutboxSentAfterDelivery(
  client: SupabaseClient<Database>,
  row: NotificationOutboxRow,
  now: Date,
): Promise<"sent" | "dry_run_preview"> {
  const preview = buildDryRunDeliveryPreview(row);
  const nowIso = now.toISOString();

  if (isNotificationDryRunProvider() && !shouldMarkDryRunSent()) {
    await markOutboxDryRunPreview(client, row.id, preview, nowIso);
    return "dry_run_preview";
  }

  const { error } = await client
    .from("notification_outbox")
    .update({
      status: "sent",
      attempts: row.attempts + 1,
      next_retry_at: null,
      last_error: isNotificationDryRunProvider() ? formatDryRunSentMetadata(preview) : null,
      updated_at: nowIso,
    })
    .eq("id", row.id);

  if (error) throw new Error(error.message);
  return "sent";
}
