import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getDeferredAssignmentConfig } from "@/features/assignments/server/assignmentDispatchConfig";
import type { Database } from "@/lib/database/types";
import {
  computeCronHealthFromBacklog,
  computeCronJobHealthFromLastRun,
  mergeCronHealthLevels,
  mergeCronHealthMessages,
} from "./computeCronJobHealth";
import {
  countAssignmentRecoveryBacklog,
  countDeferredDispatchOverdueBacklog,
  countPastExpiryOpenOfferBacklog,
  countStalePendingPaymentBacklog,
  loadDeferredDispatchCronRunSummary,
} from "./cronHealthBacklogs";
import { REGULAR_CLEANING_CRON_JOBS } from "./cronHealthCatalog";
import type { CronHealthReadModel, CronJobHealthSnapshot } from "./cronHealthTypes";

function isDeferredAssignmentEnabled(): boolean {
  return getDeferredAssignmentConfig().enabled;
}

async function buildJobSnapshot(
  client: SupabaseClient<Database>,
  job: (typeof REGULAR_CLEANING_CRON_JOBS)[number],
  now: Date,
): Promise<CronJobHealthSnapshot> {
  const deferredEnabled = isDeferredAssignmentEnabled();
  const enabled =
    job.id !== "dispatch-deferred-assignments" ? true : deferredEnabled;

  let backlogCount = 0;
  let backlogLabel = "Backlog";
  let lastSuccessfulRunAt: string | null = null;
  let lastFailureRunAt: string | null = null;
  let recentFailureCount24h: number | null = null;
  let hasRunTelemetry = false;

  if (job.id === "expire-pending-payments") {
    backlogCount = await countStalePendingPaymentBacklog(client, { now });
    backlogLabel = "Stale pending payments (pending_payment)";
  } else if (job.id === "expire-assignment-offers") {
    backlogCount = await countPastExpiryOpenOfferBacklog(client, { now });
    backlogLabel = "Open offers past expires_at";
  } else if (job.id === "recover-assignment-after-payment") {
    backlogCount = await countAssignmentRecoveryBacklog(client, { now });
    backlogLabel = "Paid confirmed, dispatch not started (past grace)";
  } else if (job.id === "dispatch-deferred-assignments") {
    if (enabled) {
      backlogCount = await countDeferredDispatchOverdueBacklog(client, {
        now,
        deferredEnabled: true,
      });
      backlogLabel = "Deferred dispatch overdue (past grace)";
      const runs = await loadDeferredDispatchCronRunSummary(client, { now });
      lastSuccessfulRunAt = runs.lastSuccessfulRunAt;
      lastFailureRunAt = runs.lastFailureRunAt;
      recentFailureCount24h = runs.recentFailureCount24h;
      hasRunTelemetry = true;
    }
  }

  if (!enabled) {
    return {
      id: job.id,
      name: job.name,
      routePath: job.routePath,
      scheduleSource: job.scheduleSource,
      scheduleHint: job.scheduleHint,
      expectedFrequencyMinutes: job.expectedFrequencyMinutes,
      docPath: job.docPath,
      launchRequired: job.launchRequired,
      enabled: false,
      status: "healthy",
      statusMessage: `Feature disabled (${job.featureFlagEnv ?? "flag"}). Not required unless deferred assignment is enabled.`,
      lastSuccessfulRunAt: null,
      lastFailureRunAt: null,
      recentFailureCount24h: null,
      backlogCount: 0,
      backlogLabel,
      hasRunTelemetry: false,
    };
  }

  const runHealth = computeCronJobHealthFromLastRun(
    lastSuccessfulRunAt,
    job.expectedFrequencyMinutes,
    now,
  );

  const backlogHealth = computeCronHealthFromBacklog(backlogCount, {
    warningThreshold: job.id === "recover-assignment-after-payment" ? 1 : 1,
    criticalThreshold:
      job.id === "recover-assignment-after-payment"
        ? 3
        : job.id === "dispatch-deferred-assignments"
          ? 3
          : 10,
  });

  let status = mergeCronHealthLevels(
    hasRunTelemetry ? runHealth.level : "unknown",
    backlogHealth.level,
  );

  if (recentFailureCount24h != null && recentFailureCount24h > 0) {
    status = mergeCronHealthLevels(status, recentFailureCount24h >= 3 ? "critical" : "warning");
  }

  const statusMessage = mergeCronHealthMessages(status, [
    hasRunTelemetry ? runHealth.message : "No run telemetry table for this job.",
    backlogHealth.message,
    recentFailureCount24h != null && recentFailureCount24h > 0
      ? `${recentFailureCount24h} failed run(s) in the last 24h.`
      : "",
  ]);

  return {
    id: job.id,
    name: job.name,
    routePath: job.routePath,
    scheduleSource: job.scheduleSource,
    scheduleHint: job.scheduleHint,
    expectedFrequencyMinutes: job.expectedFrequencyMinutes,
    docPath: job.docPath,
    launchRequired: job.launchRequired,
    enabled: true,
    status,
    statusMessage,
    lastSuccessfulRunAt,
    lastFailureRunAt,
    recentFailureCount24h,
    backlogCount,
    backlogLabel,
    hasRunTelemetry,
  };
}

export async function loadCronHealthReadModel(
  client: SupabaseClient<Database>,
  options: { now?: Date } = {},
): Promise<CronHealthReadModel> {
  const now = options.now ?? new Date();
  const jobs = await Promise.all(
    REGULAR_CLEANING_CRON_JOBS.map((job) => buildJobSnapshot(client, job, now)),
  );

  return {
    generatedAt: now.toISOString(),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    jobs,
  };
}
