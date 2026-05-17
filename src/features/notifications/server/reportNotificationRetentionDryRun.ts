import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { buildDeliverableOutboxTemplateOrFilter } from "./config";
import {
  getNotificationRetentionPolicy,
  type NotificationRetentionPolicy,
} from "./notificationRetentionConfig";
import {
  buildUtcHourCoverageSet,
  countWorkerRunsRollupEligibility,
} from "./notificationRetentionEligibility";
import type { NotificationRetentionDryRunReport } from "./notificationRetentionTypes";

const UNSUPPORTED_PENDING_TEMPLATES = [
  "booking_draft_created",
  "payment_pending",
  "pending_assignment",
  "cleaner_assigned",
] as const;

const REQUEUE_SHIELD_MAX_IDS = 500;
const WORKER_RUN_PAGE_SIZE = 1000;

async function countRows(
  builder: { then?: unknown } & PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<number> {
  const { count, error } = await builder;
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function loadRequeueShieldOutboxIds(
  client: SupabaseClient<Database>,
  sinceIso: string,
): Promise<Set<string>> {
  const { data, error } = await client
    .from("admin_operational_audit")
    .select("metadata")
    .eq("action", "notification_requeue")
    .in("outcome", ["success", "idempotent"])
    .gte("created_at", sinceIso)
    .limit(REQUEUE_SHIELD_MAX_IDS);

  if (error) {
    throw new Error(error.message);
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const meta = row.metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const outboxId = (meta as Record<string, unknown>).outboxId;
      if (typeof outboxId === "string" && outboxId.trim()) {
        ids.add(outboxId.trim());
      }
    }
  }
  return ids;
}

function withRequeueShieldExclusion<T extends { not: (column: string, operator: string, value: string) => T }>(
  builder: T,
  shieldIds: Set<string>,
): T {
  if (shieldIds.size === 0) {
    return builder;
  }
  const quoted = [...shieldIds].map((id) => `"${id}"`).join(",");
  return builder.not("id", "in", `(${quoted})`);
}

async function countOutboxEligibleLiveSent(
  client: SupabaseClient<Database>,
  cutoffIso: string,
  shieldIds: Set<string>,
): Promise<number> {
  const builder = withRequeueShieldExclusion(
    client
      .from("notification_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .lt("updated_at", cutoffIso)
      .not("last_error", "ilike", "dry_run_sent%"),
    shieldIds,
  );
  return countRows(builder);
}

async function countOutboxEligibleDryRunSent(
  client: SupabaseClient<Database>,
  cutoffIso: string,
  shieldIds: Set<string>,
): Promise<number> {
  const builder = withRequeueShieldExclusion(
    client
      .from("notification_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .lt("updated_at", cutoffIso)
      .ilike("last_error", "dry_run_sent%"),
    shieldIds,
  );
  return countRows(builder);
}

async function countOutboxEligibleFailedExpired(
  client: SupabaseClient<Database>,
  cutoffIso: string,
  shieldIds: Set<string>,
): Promise<number> {
  const builder = withRequeueShieldExclusion(
    client
      .from("notification_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .lt("updated_at", cutoffIso)
      .or(buildDeliverableOutboxTemplateOrFilter()),
    shieldIds,
  );
  return countRows(builder);
}

async function countOutboxEligibleUnsupportedPending(
  client: SupabaseClient<Database>,
  cutoffIso: string,
): Promise<number> {
  return countRows(
    client
      .from("notification_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", cutoffIso)
      .in("payload->>template", [...UNSUPPORTED_PENDING_TEMPLATES]),
  );
}

async function countOutboxProtectedPendingDeliverable(
  client: SupabaseClient<Database>,
): Promise<number> {
  return countRows(
    client
      .from("notification_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .or(buildDeliverableOutboxTemplateOrFilter()),
  );
}

async function countOutboxProtectedProcessing(
  client: SupabaseClient<Database>,
): Promise<number> {
  return countRows(
    client
      .from("notification_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "processing"),
  );
}

async function countOutboxProtectedFailedWithinRetention(
  client: SupabaseClient<Database>,
  failedRetentionCutoffIso: string,
): Promise<number> {
  return countRows(
    client
      .from("notification_outbox")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("updated_at", failedRetentionCutoffIso)
      .or(buildDeliverableOutboxTemplateOrFilter()),
  );
}

async function countOutboxRequeueShieldRows(
  client: SupabaseClient<Database>,
  shieldIds: Set<string>,
): Promise<number> {
  if (shieldIds.size === 0) {
    return 0;
  }
  return countRows(
    client
      .from("notification_outbox")
      .select("*", { count: "exact", head: true })
      .in("id", [...shieldIds]),
  );
}

async function loadOldestLiveSentTimestamp(
  client: SupabaseClient<Database>,
  cutoffIso: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("notification_outbox")
    .select("updated_at")
    .eq("status", "sent")
    .lt("updated_at", cutoffIso)
    .not("last_error", "ilike", "dry_run_sent%")
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.updated_at ?? null;
}

async function loadOldestDryRunSentTimestamp(
  client: SupabaseClient<Database>,
  cutoffIso: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("notification_outbox")
    .select("updated_at")
    .eq("status", "sent")
    .lt("updated_at", cutoffIso)
    .ilike("last_error", "dry_run_sent%")
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.updated_at ?? null;
}

async function loadOldestFailedExpiredTimestamp(
  client: SupabaseClient<Database>,
  cutoffIso: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("notification_outbox")
    .select("updated_at")
    .eq("status", "failed")
    .lt("updated_at", cutoffIso)
    .or(buildDeliverableOutboxTemplateOrFilter())
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.updated_at ?? null;
}

async function loadOldestUnsupportedPendingTimestamp(
  client: SupabaseClient<Database>,
  cutoffIso: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("notification_outbox")
    .select("created_at")
    .eq("status", "pending")
    .lt("created_at", cutoffIso)
    .in("payload->>template", [...UNSUPPORTED_PENDING_TEMPLATES])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.created_at ?? null;
}

async function loadOldestWorkerRunTimestamp(
  client: SupabaseClient<Database>,
  cutoffIso: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("notification_worker_runs")
    .select("completed_at")
    .lt("completed_at", cutoffIso)
    .order("completed_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.completed_at === "string" ? data.completed_at : null;
}

async function loadOldestMetricsHourlyTimestamp(
  client: SupabaseClient<Database>,
  cutoffIso: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("notification_metrics_hourly")
    .select("bucket_start")
    .lt("bucket_start", cutoffIso)
    .order("bucket_start", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return typeof data?.bucket_start === "string" ? data.bucket_start : null;
}

async function loadMetricsHourlyBucketStarts(
  client: SupabaseClient<Database>,
): Promise<string[]> {
  const { data, error } = await client
    .from("notification_metrics_hourly")
    .select("bucket_start");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => row.bucket_start)
    .filter((v): v is string => typeof v === "string");
}

async function countMetricsHourlyOlderThan(
  client: SupabaseClient<Database>,
  cutoffIso: string,
): Promise<number> {
  return countRows(
    client
      .from("notification_metrics_hourly")
      .select("*", { count: "exact", head: true })
      .lt("bucket_start", cutoffIso),
  );
}

async function countWorkerRunsOlderThan(
  client: SupabaseClient<Database>,
  cutoffIso: string,
): Promise<number> {
  return countRows(
    client
      .from("notification_worker_runs")
      .select("*", { count: "exact", head: true })
      .lt("completed_at", cutoffIso),
  );
}

async function loadWorkerRunCompletedAtOlderThan(
  client: SupabaseClient<Database>,
  cutoffIso: string,
): Promise<string[]> {
  const timestamps: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from("notification_worker_runs")
      .select("completed_at")
      .lt("completed_at", cutoffIso)
      .order("completed_at", { ascending: true })
      .range(offset, offset + WORKER_RUN_PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    if (!data?.length) {
      break;
    }

    for (const row of data) {
      if (typeof row.completed_at === "string") {
        timestamps.push(row.completed_at);
      }
    }

    if (data.length < WORKER_RUN_PAGE_SIZE) {
      break;
    }
    offset += WORKER_RUN_PAGE_SIZE;
  }

  return timestamps;
}

async function buildWorkerRunsRetentionCounts(
  client: SupabaseClient<Database>,
  policy: NotificationRetentionPolicy,
): Promise<{
  olderThanPolicy: number;
  eligibleWithRollupCoverage: number;
  protectedMissingRollup: number;
}> {
  const cutoffIso = policy.cutoffs.workerRunsBefore;
  const [olderThanPolicy, bucketStarts, completedAtList] = await Promise.all([
    countWorkerRunsOlderThan(client, cutoffIso),
    loadMetricsHourlyBucketStarts(client),
    loadWorkerRunCompletedAtOlderThan(client, cutoffIso),
  ]);

  const coveredHours = buildUtcHourCoverageSet(bucketStarts);
  const { eligible, protectedMissingRollup } = countWorkerRunsRollupEligibility(
    completedAtList,
    cutoffIso,
    coveredHours,
  );

  return {
    olderThanPolicy,
    eligibleWithRollupCoverage: eligible,
    protectedMissingRollup,
  };
}

/**
 * Read-only retention dry-run report. Never DELETE/UPDATE.
 */
export async function reportNotificationRetentionDryRun(
  client: SupabaseClient<Database>,
  now: Date = new Date(),
): Promise<NotificationRetentionDryRunReport> {
  const policy = getNotificationRetentionPolicy(now);
  const shieldIds = await loadRequeueShieldOutboxIds(
    client,
    policy.cutoffs.requeueShieldSince,
  );

  const [
    liveSentOlderThanPolicy,
    dryRunSentOlderThanPolicy,
    failedOlderThanPolicy,
    unsupportedPendingOlderThanPolicy,
    pendingDeliverable,
    processing,
    failedWithinRetention,
    requeueShieldRecent,
    metricsHourlyOlder,
    workerRuns,
    oldestLiveSent,
    oldestDryRunSent,
    oldestFailedExpired,
    oldestUnsupportedPending,
    oldestWorkerRun,
    oldestMetricsHourly,
  ] = await Promise.all([
    countOutboxEligibleLiveSent(client, policy.cutoffs.outboxLiveSentBefore, shieldIds),
    countOutboxEligibleDryRunSent(client, policy.cutoffs.outboxDryRunSentBefore, shieldIds),
    countOutboxEligibleFailedExpired(client, policy.cutoffs.outboxFailedExpiredBefore, shieldIds),
    countOutboxEligibleUnsupportedPending(
      client,
      policy.cutoffs.outboxUnsupportedPendingBefore,
    ),
    countOutboxProtectedPendingDeliverable(client),
    countOutboxProtectedProcessing(client),
    countOutboxProtectedFailedWithinRetention(
      client,
      policy.cutoffs.outboxFailedExpiredBefore,
    ),
    countOutboxRequeueShieldRows(client, shieldIds),
    countMetricsHourlyOlderThan(client, policy.cutoffs.metricsHourlyBefore),
    buildWorkerRunsRetentionCounts(client, policy),
    loadOldestLiveSentTimestamp(client, policy.cutoffs.outboxLiveSentBefore),
    loadOldestDryRunSentTimestamp(client, policy.cutoffs.outboxDryRunSentBefore),
    loadOldestFailedExpiredTimestamp(client, policy.cutoffs.outboxFailedExpiredBefore),
    loadOldestUnsupportedPendingTimestamp(client, policy.cutoffs.outboxUnsupportedPendingBefore),
    loadOldestWorkerRunTimestamp(client, policy.cutoffs.workerRunsBefore),
    loadOldestMetricsHourlyTimestamp(client, policy.cutoffs.metricsHourlyBefore),
  ]);

  return {
    dryRun: true,
    deleted: 0,
    asOf: now.toISOString(),
    policy: {
      outboxLiveSentDays: policy.outboxLiveSentDays,
      outboxDryRunSentDays: policy.outboxDryRunSentDays,
      outboxFailedMaxDays: policy.outboxFailedMaxDays,
      outboxUnsupportedPendingDays: policy.outboxUnsupportedPendingDays,
      workerRunsDays: policy.workerRunsDays,
      metricsMonths: policy.metricsMonths,
      requeueShieldDays: policy.requeueShieldDays,
    },
    eligible: {
      outbox: {
        liveSentOlderThanPolicy,
        dryRunSentOlderThanPolicy,
        failedOlderThanPolicy,
        unsupportedPendingOlderThanPolicy,
      },
      workerRuns,
      metricsHourly: {
        olderThanPolicy: metricsHourlyOlder,
      },
    },
    protected: {
      outbox: {
        pendingDeliverable,
        processing,
        failedWithinRetention,
        requeueShieldRecent,
      },
    },
    oldestEligible: {
      liveSent: oldestLiveSent,
      dryRunSent: oldestDryRunSent,
      failedExpired: oldestFailedExpired,
      unsupportedPending: oldestUnsupportedPending,
      workerRuns: oldestWorkerRun,
      metricsHourly: oldestMetricsHourly,
    },
  };
}
