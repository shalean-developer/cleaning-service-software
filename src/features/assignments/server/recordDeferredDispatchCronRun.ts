import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";
import type { DeferredAssignmentDispatchBatchResult } from "./runDeferredAssignmentDispatch";

const MAX_FAILED_ENTRIES = 20;
const MAX_MESSAGE_LENGTH = 200;

export type DeferredDispatchCronTriggerSource = "cron" | "manual";

export function isDeferredDispatchCronRunLoggingEnabled(): boolean {
  return process.env.DEFERRED_DISPATCH_CRON_RUN_LOGGING?.trim().toLowerCase() !== "false";
}

export function parseDeferredDispatchCronTriggerSource(
  request: Request,
): DeferredDispatchCronTriggerSource {
  const header = request.headers.get("x-cron-invoke-source")?.trim().toLowerCase();
  return header === "manual" ? "manual" : "cron";
}

function sanitizeFailed(
  failed: DeferredAssignmentDispatchBatchResult["failed"],
): Json {
  return failed.slice(0, MAX_FAILED_ENTRIES).map((entry) => ({
    bookingId: entry.bookingId,
    code: entry.code.slice(0, 80),
    message: entry.message.slice(0, MAX_MESSAGE_LENGTH),
  })) as unknown as Json;
}

export async function recordDeferredDispatchCronRun(
  client: SupabaseClient<Database> | null,
  input: {
    startedAt: Date;
    completedAt?: Date;
    ok: boolean;
    request: Request;
    result: DeferredAssignmentDispatchBatchResult;
  },
): Promise<void> {
  if (!client || !isDeferredDispatchCronRunLoggingEnabled()) return;

  const completedAt = input.completedAt ?? new Date();
  const triggerSource = parseDeferredDispatchCronTriggerSource(input.request);

  try {
    const { error } = await client.from("deferred_dispatch_cron_runs").insert({
      started_at: input.startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      ok: input.ok,
      trigger_source: triggerSource,
      candidate_count: input.result.candidateCount,
      attempted_count: input.result.attemptedCount,
      dispatched_count: input.result.dispatchedBookingIds.length,
      skipped_count: input.result.skippedBookingIds.length,
      failed_count: input.result.failed.length,
      failed: sanitizeFailed(input.result.failed),
    });
    if (error) {
      console.warn(
        JSON.stringify({
          event: "deferred_dispatch_cron_run_persist_failed",
          message: error.message,
        }),
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown persist error";
    console.warn(
      JSON.stringify({
        event: "deferred_dispatch_cron_run_persist_failed",
        message,
      }),
    );
  }
}
