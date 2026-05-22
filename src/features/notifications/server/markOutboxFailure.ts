import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NOTIFICATION_MAX_ATTEMPTS,
  NOTIFICATION_RETRY_BASE_MINUTES,
} from "./config";
import type { Database, NotificationOutboxRow } from "@/lib/database/types";

function computeNextRetryAt(attempts: number, now: Date): string {
  const multiplier = Math.min(2 ** Math.max(attempts - 1, 0), 32);
  const delayMs = NOTIFICATION_RETRY_BASE_MINUTES * 60_000 * multiplier;
  return new Date(now.getTime() + delayMs).toISOString();
}

function sanitizeErrorMessage(message: string): string {
  return message.replace(/\S+@\S+/g, "[redacted]").slice(0, 500);
}

export async function markOutboxFailure(
  client: SupabaseClient<Database>,
  row: NotificationOutboxRow,
  errorMessage: string,
  retryable: boolean,
  now: Date,
): Promise<void> {
  const attempts = row.attempts + 1;
  const nowIso = now.toISOString();
  const exhausted = !retryable || attempts >= NOTIFICATION_MAX_ATTEMPTS;

  const { error } = await client
    .from("notification_outbox")
    .update({
      status: exhausted ? "failed" : "pending",
      attempts,
      next_retry_at: exhausted ? null : computeNextRetryAt(attempts, now),
      last_error: sanitizeErrorMessage(errorMessage),
      updated_at: nowIso,
    })
    .eq("id", row.id);

  if (error) throw new Error(error.message);
}
