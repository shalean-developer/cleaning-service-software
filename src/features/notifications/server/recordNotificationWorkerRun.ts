import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";
import type {
  ProcessNotificationOutboxError,
  ProcessNotificationOutboxResult,
} from "./processNotificationOutbox";
import type { NotificationWorkerRunTriggerSource } from "./notificationWorkerRunTypes";

const MAX_WORKER_RUN_ERRORS = 10;
const MAX_ERROR_MESSAGE_LENGTH = 200;

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function isNotificationWorkerRunLoggingEnabled(): boolean {
  return process.env.NOTIFICATION_WORKER_RUN_LOGGING?.trim().toLowerCase() !== "false";
}

export function parseNotificationWorkerTriggerSource(
  request: Request,
): NotificationWorkerRunTriggerSource {
  const header = request.headers.get("x-cron-invoke-source")?.trim().toLowerCase();
  return header === "manual" ? "manual" : "cron";
}

function stripEmailLikeText(value: string): string {
  return value.replace(EMAIL_PATTERN, "[redacted]").trim();
}

/** @internal Exported for tests. */
export function sanitizeWorkerRunErrors(
  errors: ProcessNotificationOutboxError[] | null | undefined,
): Json {
  if (!errors?.length) return [];

  const safe: ProcessNotificationOutboxError[] = [];
  for (const entry of errors.slice(0, MAX_WORKER_RUN_ERRORS)) {
    if (!entry || typeof entry !== "object") continue;
    const outboxId = typeof entry.outboxId === "string" ? entry.outboxId.trim() : "";
    const code = typeof entry.code === "string" ? entry.code.trim().slice(0, 80) : "";
    const message =
      typeof entry.message === "string"
        ? stripEmailLikeText(entry.message).slice(0, MAX_ERROR_MESSAGE_LENGTH)
        : "";
    if (!outboxId || !code || !message) continue;
    safe.push({ outboxId, code, message });
  }
  return safe as unknown as Json;
}

export type RecordNotificationWorkerRunInput = {
  startedAt: Date;
  completedAt?: Date;
  ok: boolean;
  request: Request;
  result?: ProcessNotificationOutboxResult;
  error?: unknown;
};

/**
 * Persists one notification worker run via service role. Never throws — logs on failure.
 */
export async function recordNotificationWorkerRun(
  client: SupabaseClient<Database> | null,
  input: RecordNotificationWorkerRunInput,
): Promise<void> {
  if (!client || !isNotificationWorkerRunLoggingEnabled()) return;

  const completedAt = input.completedAt ?? new Date();
  const triggerSource = parseNotificationWorkerTriggerSource(input.request);
  const errors = input.result?.errors
    ? sanitizeWorkerRunErrors(input.result.errors)
    : input.error
      ? sanitizeWorkerRunErrors([
          {
            outboxId: "n/a",
            code: "INTERNAL_ERROR",
            message:
              input.error instanceof Error
                ? stripEmailLikeText(input.error.message).slice(0, MAX_ERROR_MESSAGE_LENGTH)
                : "Notification outbox processing failed.",
          },
        ])
      : [];

  const errorCount = Array.isArray(errors) ? errors.length : 0;

  const row = input.result
    ? {
        started_at: input.startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        ok: input.ok,
        delivery_enabled: input.result.deliveryEnabled,
        email_provider: input.result.emailProvider,
        trigger_source: triggerSource,
        reclaimed: input.result.reclaimed,
        scanned: input.result.scanned,
        sent: input.result.sent,
        skipped: input.result.skipped,
        failed: input.result.failed,
        dry_run: input.result.dryRun,
        error_count: errorCount,
        errors,
      }
    : {
        started_at: input.startedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        ok: false,
        delivery_enabled: false,
        email_provider: null,
        trigger_source: triggerSource,
        reclaimed: 0,
        scanned: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        dry_run: 0,
        error_count: errorCount,
        errors,
      };

  try {
    const { error } = await client.from("notification_worker_runs").insert(row);
    if (error) {
      console.warn(
        JSON.stringify({
          event: "notification_worker_run_persist_failed",
          at: new Date().toISOString(),
          ok: input.ok,
          triggerSource,
          code: error.code,
          message: error.message,
        }),
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.warn(
      JSON.stringify({
        event: "notification_worker_run_persist_failed",
        at: new Date().toISOString(),
        ok: input.ok,
        triggerSource,
        message,
      }),
    );
  }
}
