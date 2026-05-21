import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";
import type { GenerateRecurringOccurrencesResult } from "../generateRecurringOccurrences";

const MAX_ERROR_ENTRIES = 20;
const MAX_MESSAGE_LENGTH = 300;

export type RecurringGenerationRunStatus = "success" | "partial" | "failed";

export function isRecurringGenerationRunLoggingEnabled(): boolean {
  return process.env.RECURRING_GENERATION_RUN_LOGGING?.trim().toLowerCase() !== "false";
}

export function deriveRecurringGenerationRunStatus(
  result: GenerateRecurringOccurrencesResult,
  ok: boolean,
): RecurringGenerationRunStatus {
  if (!ok) return "failed";
  if (result.errors > 0) return "partial";
  return "success";
}

function sanitizeErrors(errors: string[]): Json {
  return errors.slice(0, MAX_ERROR_ENTRIES).map((message) => ({
    message: message.slice(0, MAX_MESSAGE_LENGTH),
  })) as unknown as Json;
}

export async function recordRecurringGenerationRun(
  client: SupabaseClient<Database> | null,
  input: {
    runId: string;
    startedAt: Date;
    completedAt: Date;
    status: RecurringGenerationRunStatus;
    result: GenerateRecurringOccurrencesResult;
    errorMessages?: string[];
  },
): Promise<void> {
  if (!client || !isRecurringGenerationRunLoggingEnabled()) return;

  const durationMs = Math.max(0, input.completedAt.getTime() - input.startedAt.getTime());

  try {
    const { error } = await client.from("recurring_generation_runs").insert({
      run_id: input.runId,
      started_at: input.startedAt.toISOString(),
      completed_at: input.completedAt.toISOString(),
      duration_ms: durationMs,
      status: input.status,
      active_series_scanned: input.result.seriesScanned,
      children_generated: input.result.created,
      duplicates_skipped: input.result.skippedExisting,
      skipped_paused: input.result.skippedPaused,
      skipped_cancelled: input.result.skippedCancelled,
      failures_count: input.result.errors,
      error_summary: sanitizeErrors(input.errorMessages ?? []),
    });
    if (error) {
      console.warn(
        JSON.stringify({
          event: "recurring_generation_run_persist_failed",
          runId: input.runId,
          message: error.message,
        }),
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown persist error";
    console.warn(
      JSON.stringify({
        event: "recurring_generation_run_persist_failed",
        runId: input.runId,
        message,
      }),
    );
  }
}

export function logRecurringGenerationRunConsole(input: {
  runId: string;
  startedAt: Date;
  completedAt: Date;
  status: RecurringGenerationRunStatus;
  result: GenerateRecurringOccurrencesResult;
  errorMessages?: string[];
}): void {
  const durationMs = Math.max(0, input.completedAt.getTime() - input.startedAt.getTime());
  console.info(
    JSON.stringify({
      event: "recurring_generation_run",
      runId: input.runId,
      startedAt: input.startedAt.toISOString(),
      completedAt: input.completedAt.toISOString(),
      durationMs,
      status: input.status,
      activeSeriesScanned: input.result.seriesScanned,
      childrenGenerated: input.result.created,
      duplicatesSkipped: input.result.skippedExisting,
      skippedAnchor: input.result.skippedAnchor,
      skippedPaused: input.result.skippedPaused,
      skippedCancelled: input.result.skippedCancelled,
      failuresCount: input.result.errors,
      errorMessages: input.errorMessages ?? [],
    }),
  );
}
