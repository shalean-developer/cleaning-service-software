import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupportNotificationTemplate } from "./config";
import type { Database, Json } from "@/lib/database/types";

function readDedupeKey(payload: Json): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const key = (payload as Record<string, unknown>).dedupeKey;
  return typeof key === "string" && key.trim() ? key.trim() : null;
}

function readTemplate(payload: Json): string | null {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const template = (payload as Record<string, unknown>).template;
  return typeof template === "string" ? template : null;
}

/**
 * True when another outbox row already delivered a support notification with this dedupe key.
 */
export async function hasSentSupportNotificationForDedupeKey(
  client: SupabaseClient<Database>,
  dedupeKey: string,
  excludeOutboxId?: string,
): Promise<boolean> {
  const { data, error } = await client
    .from("notification_outbox")
    .select("id, payload")
    .eq("status", "sent")
    .eq("channel", "email");

  if (error) {
    throw new Error(error.message);
  }

  for (const row of data ?? []) {
    if (excludeOutboxId && row.id === excludeOutboxId) continue;
    if (!isSupportNotificationTemplate(readTemplate(row.payload))) continue;
    if (readDedupeKey(row.payload) === dedupeKey) return true;
  }

  return false;
}
