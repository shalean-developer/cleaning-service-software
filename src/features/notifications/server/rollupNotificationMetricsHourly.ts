import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  bucketEndExclusive,
  floorToUtcHour,
  isCurrentPartialUtcHour,
  NOTIFICATION_METRICS_BACKFILL_CONCURRENCY,
  NOTIFICATION_METRICS_MAX_BACKFILL_HOURS,
  previousClosedUtcHour,
  parseUtcHourBucketStart,
} from "./notificationMetricsHourlyUtc";

export const WORKER_RUN_ROLLUP_SELECT =
  "ok, delivery_enabled, email_provider, reclaimed, scanned, sent, skipped, failed, dry_run";

export type WorkerRunRollupInput = {
  ok: boolean;
  delivery_enabled: boolean;
  email_provider: string | null;
  reclaimed: number;
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  dry_run: number;
};

export type NotificationMetricsHourlyRow = {
  bucket_start: string;
  run_count: number;
  ok_run_count: number;
  failed_run_count: number;
  delivery_enabled_run_count: number;
  resend_run_count: number;
  dry_run_provider_run_count: number;
  reclaimed_count: number;
  scanned_count: number;
  sent_count: number;
  skipped_count: number;
  failed_count: number;
  dry_run_count: number;
  live_sent_count: number;
  live_failed_count: number;
};

export type RollupNotificationMetricsHourlyResult = {
  bucketStart: string;
  runCount: number;
  liveSent: number;
  liveFailed: number;
  dryRun: number;
  upserted: boolean;
};

export function isNotificationMetricsRollupEnabled(): boolean {
  const raw = process.env.NOTIFICATION_METRICS_ROLLUP_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0") return false;
  return true;
}

/** @internal Exported for tests. */
export function aggregateWorkerRunsToHourlyRow(
  bucketStart: Date,
  runs: WorkerRunRollupInput[],
): NotificationMetricsHourlyRow {
  let okRunCount = 0;
  let deliveryEnabledRunCount = 0;
  let resendRunCount = 0;
  let dryRunProviderRunCount = 0;
  let reclaimedCount = 0;
  let scannedCount = 0;
  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let dryRunCount = 0;
  let liveSentCount = 0;
  let liveFailedCount = 0;

  for (const run of runs) {
    if (run.ok) okRunCount += 1;
    if (run.delivery_enabled) deliveryEnabledRunCount += 1;
    if (run.email_provider === "resend") resendRunCount += 1;
    if (run.email_provider === "dry_run") dryRunProviderRunCount += 1;
    reclaimedCount += run.reclaimed;
    scannedCount += run.scanned;
    sentCount += run.sent;
    skippedCount += run.skipped;
    failedCount += run.failed;
    dryRunCount += run.dry_run;

    if (run.delivery_enabled && run.email_provider === "resend") {
      liveSentCount += run.sent;
      liveFailedCount += run.failed;
    }
  }

  const runCount = runs.length;

  return {
    bucket_start: bucketStart.toISOString(),
    run_count: runCount,
    ok_run_count: okRunCount,
    failed_run_count: runCount - okRunCount,
    delivery_enabled_run_count: deliveryEnabledRunCount,
    resend_run_count: resendRunCount,
    dry_run_provider_run_count: dryRunProviderRunCount,
    reclaimed_count: reclaimedCount,
    scanned_count: scannedCount,
    sent_count: sentCount,
    skipped_count: skippedCount,
    failed_count: failedCount,
    dry_run_count: dryRunCount,
    live_sent_count: liveSentCount,
    live_failed_count: liveFailedCount,
  };
}

export function resolveRollupBucketStart(
  bucketStartParam: string | null | undefined,
  now: Date = new Date(),
): Date {
  if (bucketStartParam) {
    const parsed = parseUtcHourBucketStart(bucketStartParam);
    if (!parsed) {
      throw new Error("Invalid bucketStart. expected UTC hour ISO timestamp.");
    }
    if (isCurrentPartialUtcHour(parsed, now)) {
      throw new Error("Cannot roll up the current partial UTC hour.");
    }
    return parsed;
  }
  return previousClosedUtcHour(now);
}

export async function rollupNotificationMetricsHourly(
  client: SupabaseClient<Database>,
  bucketStartParam?: string | null,
  now: Date = new Date(),
): Promise<RollupNotificationMetricsHourlyResult> {
  const bucketStart = resolveRollupBucketStart(bucketStartParam, now);
  const bucketEnd = bucketEndExclusive(bucketStart);
  const bucketStartIso = bucketStart.toISOString();
  const bucketEndIso = bucketEnd.toISOString();

  const { data, error } = await client
    .from("notification_worker_runs")
    .select(WORKER_RUN_ROLLUP_SELECT)
    .gte("completed_at", bucketStartIso)
    .lt("completed_at", bucketEndIso);

  if (error) {
    throw new Error(error.message);
  }

  const runs = (data ?? []) as WorkerRunRollupInput[];
  const row = aggregateWorkerRunsToHourlyRow(bucketStart, runs);
  const updatedAt = now.toISOString();

  const { error: upsertError } = await client.from("notification_metrics_hourly").upsert(
    {
      ...row,
      updated_at: updatedAt,
    },
    { onConflict: "bucket_start" },
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  return {
    bucketStart: bucketStartIso,
    runCount: row.run_count,
    liveSent: row.live_sent_count,
    liveFailed: row.live_failed_count,
    dryRun: row.dry_run_count,
    upserted: true,
  };
}

export type BackfillNotificationMetricsHourlyResult = {
  hoursRequested: number;
  hoursProcessed: number;
  hoursFailed: number;
};

/** @internal Exported for tests. */
export function listBackfillBucketStarts(hours: number, now: Date = new Date()): Date[] {
  const closed = previousClosedUtcHour(now);
  const bucketStarts: Date[] = [];
  for (let i = hours; i >= 1; i -= 1) {
    bucketStarts.push(new Date(closed.getTime() - (i - 1) * 60 * 60_000));
  }
  return bucketStarts;
}

export async function backfillNotificationMetricsHourly(
  client: SupabaseClient<Database>,
  options: {
    hours?: number;
    now?: Date;
    concurrency?: number;
    onProgress?: (progress: {
      completed: number;
      total: number;
      hoursProcessed: number;
      hoursFailed: number;
    }) => void;
  } = {},
): Promise<BackfillNotificationMetricsHourlyResult> {
  const now = options.now ?? new Date();
  const hours = Math.min(
    Math.max(1, options.hours ?? NOTIFICATION_METRICS_MAX_BACKFILL_HOURS),
    NOTIFICATION_METRICS_MAX_BACKFILL_HOURS,
  );
  const envConcurrency = Number.parseInt(
    process.env.NOTIFICATION_METRICS_BACKFILL_CONCURRENCY?.trim() ?? "",
    10,
  );
  const concurrency =
    options.concurrency ??
    (Number.isFinite(envConcurrency) && envConcurrency > 0
      ? envConcurrency
      : NOTIFICATION_METRICS_BACKFILL_CONCURRENCY);

  const bucketStarts = listBackfillBucketStarts(hours, now);
  let hoursProcessed = 0;
  let hoursFailed = 0;
  let completed = 0;
  const batchSize = Math.min(Math.max(1, concurrency), bucketStarts.length);

  for (let offset = 0; offset < bucketStarts.length; offset += batchSize) {
    const chunk = bucketStarts.slice(offset, offset + batchSize);
    const outcomes = await Promise.all(
      chunk.map(async (bucketStart) => {
        try {
          await rollupNotificationMetricsHourly(client, bucketStart.toISOString(), now);
          return true;
        } catch {
          return false;
        }
      }),
    );

    hoursProcessed += outcomes.filter(Boolean).length;
    hoursFailed += outcomes.filter((ok) => !ok).length;
    completed += chunk.length;
    options.onProgress?.({
      completed,
      total: bucketStarts.length,
      hoursProcessed,
      hoursFailed,
    });
  }

  return {
    hoursRequested: hours,
    hoursProcessed,
    hoursFailed,
  };
}

export { floorToUtcHour, parseUtcHourBucketStart, previousClosedUtcHour };
