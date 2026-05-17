import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import { isLocalhostAppBaseUrl } from "@/lib/app/appBaseUrl";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, NotificationOutboxStatus } from "@/lib/database/types";
import {
  buildDeliverableOutboxTemplateOrFilter,
  canRunNotificationDelivery,
  DELIVERABLE_NOTIFICATION_SPECS,
  getNotificationDeliveryConfig,
  getProcessingStaleMinutes,
  isNotificationDeliveryEnabled,
} from "./config";
import {
  computeQueuePressure,
  computeWorker24hAnalytics,
  NOTIFICATION_ANALYTICS_WINDOW_HOURS,
} from "./notificationAnalyticsAggregates";
import { computeTrends7dFromHourlyBuckets } from "./notificationTrends7d";
import type { NotificationMetricsHourlyBucket } from "./notificationTrends7d";
import { mapNotificationOutboxRowForAdmin } from "./mapNotificationOutboxRowForAdmin";
import { findOldestActionablePendingAgeMs } from "./notificationAdminAggregates";
import type {
  AdminNotificationAnalytics,
  AdminNotificationDeliveryBannerModel,
  AdminNotificationHealthPageResult,
  NotificationDeliverableFilter,
  NotificationDeliverableTemplateRow,
  NotificationHealthFilters,
  NotificationHealthSummary,
  NotificationUnsupportedTemplateRow,
} from "./notificationAdminTypes";
import { ADMIN_NOTIFICATION_GLOBAL_LIST_LIMIT } from "./notificationAdminTypes";
import { isDeliverableNotificationRow } from "./notificationOutboxDeliverability";
import { computeWorkerRunHealth } from "./computeWorkerRunHealth";
import { mapNotificationWorkerRunForAdmin } from "./mapNotificationWorkerRunForAdmin";
import type {
  AdminNotificationWorkerHealthModel,
  AdminNotificationWorkerRunListItem,
} from "./notificationWorkerRunTypes";
import { RECENT_WORKER_RUNS_LIMIT } from "./notificationWorkerRunTypes";
import { reportNotificationRetentionDryRun } from "./reportNotificationRetentionDryRun";

const OUTBOX_SELECT =
  "id, channel, recipient, payload, status, attempts, next_retry_at, last_error, created_at, updated_at";

/** Enqueued templates not yet delivered by the worker (5C-2b). */
const UNSUPPORTED_PENDING_TEMPLATES = [
  "booking_draft_created",
  "payment_pending",
  "pending_assignment",
  "cleaner_assigned",
] as const;

const DEFAULT_NEEDS_ATTENTION_STATUSES: NotificationOutboxStatus[] = [
  "pending",
  "processing",
  "failed",
];

type CountQuery = {
  status?: NotificationOutboxStatus | NotificationOutboxStatus[];
  deliverable?: boolean;
  template?: string;
  channel?: string;
  actionablePending?: boolean;
  scheduledRetry?: boolean;
  staleProcessing?: boolean;
  unsupportedTemplateIn?: boolean;
  dryRun?: boolean;
};

async function countOutboxRows(
  client: SupabaseClient<Database>,
  query: CountQuery,
  nowIso: string,
  staleIso: string,
): Promise<number> {
  let builder = client
    .from("notification_outbox")
    .select("*", { count: "exact", head: true });

  if (query.status) {
    if (Array.isArray(query.status)) {
      builder = builder.in("status", query.status);
    } else {
      builder = builder.eq("status", query.status);
    }
  }

  if (query.template) {
    builder = builder.eq("payload->>template", query.template);
  }

  if (query.channel) {
    builder = builder.eq("channel", query.channel);
  }

  if (query.deliverable === true) {
    builder = builder.or(buildDeliverableOutboxTemplateOrFilter());
  } else if (query.unsupportedTemplateIn) {
    builder = builder.in("payload->>template", [...UNSUPPORTED_PENDING_TEMPLATES]);
  }

  if (query.actionablePending) {
    builder = builder.or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`);
  }

  if (query.scheduledRetry) {
    builder = builder.gt("next_retry_at", nowIso);
  }

  if (query.staleProcessing) {
    builder = builder.lt("updated_at", staleIso);
  }

  if (query.dryRun) {
    builder = builder.ilike("last_error", "dry_run_sent%");
  }

  const { count, error } = await builder;
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function loadNotificationHealthSummary(
  client: SupabaseClient<Database>,
  now: Date,
): Promise<NotificationHealthSummary> {
  const nowIso = now.toISOString();
  const staleMinutes = getProcessingStaleMinutes();
  const staleIso = new Date(now.getTime() - staleMinutes * 60_000).toISOString();

  const [
    sent,
    actionablePending,
    scheduledRetry,
    processing,
    failed,
    staleProcessing,
    unsupportedPending,
    dryRun,
  ] = await Promise.all([
    countOutboxRows(client, { status: "sent", deliverable: true }, nowIso, staleIso),
    countOutboxRows(
      client,
      { status: "pending", deliverable: true, actionablePending: true },
      nowIso,
      staleIso,
    ),
    countOutboxRows(
      client,
      { status: "pending", deliverable: true, scheduledRetry: true },
      nowIso,
      staleIso,
    ),
    countOutboxRows(client, { status: "processing", deliverable: true }, nowIso, staleIso),
    countOutboxRows(client, { status: "failed", deliverable: true }, nowIso, staleIso),
    countOutboxRows(
      client,
      { status: "processing", deliverable: true, staleProcessing: true },
      nowIso,
      staleIso,
    ),
    countOutboxRows(
      client,
      { status: "pending", unsupportedTemplateIn: true },
      nowIso,
      staleIso,
    ),
    countOutboxRows(client, { deliverable: true, dryRun: true }, nowIso, staleIso),
  ]);

  return {
    sent,
    actionablePending,
    scheduledRetry,
    processing,
    failed,
    staleProcessing,
    unsupportedPending,
    dryRun,
  };
}

async function loadOldestActionablePendingAgeMs(
  client: SupabaseClient<Database>,
  now: Date,
): Promise<number | null> {
  const nowIso = now.toISOString();
  const { data, error } = await client
    .from("notification_outbox")
    .select(OUTBOX_SELECT)
    .eq("status", "pending")
    .or(buildDeliverableOutboxTemplateOrFilter())
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const row = data?.[0];
  if (!row) return null;
  return findOldestActionablePendingAgeMs([row], now);
}

async function listFilteredNotificationRows(
  client: SupabaseClient<Database>,
  filters: NotificationHealthFilters,
): Promise<ReturnType<typeof mapNotificationOutboxRowForAdmin>[]> {
  let builder = client.from("notification_outbox").select(OUTBOX_SELECT);

  if (filters.deliverable === "true") {
    builder = builder.or(buildDeliverableOutboxTemplateOrFilter());
  } else if (filters.deliverable === "false") {
    builder = builder
      .eq("status", "pending")
      .in("payload->>template", [...UNSUPPORTED_PENDING_TEMPLATES]);
  }

  if (filters.status.length > 0) {
    builder = builder.in("status", filters.status);
  }

  if (filters.template) {
    builder = builder.eq("payload->>template", filters.template);
  }

  const { data, error } = await builder
    .order("created_at", { ascending: false })
    .limit(ADMIN_NOTIFICATION_GLOBAL_LIST_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  let rows = (data ?? []).map((row) =>
    mapNotificationOutboxRowForAdmin(row, { requeueActionsEnabled: true }),
  );

  if (filters.deliverable === "all") {
    return rows;
  }

  if (filters.deliverable === "false") {
    return rows.filter((r) => !r.isDeliverable);
  }

  return rows.filter((r) => r.isDeliverable);
}

const WORKER_RUN_SELECT =
  "id, started_at, completed_at, ok, delivery_enabled, email_provider, trigger_source, reclaimed, scanned, sent, skipped, failed, dry_run, error_count, created_at";

/** Worker fields for 24h analytics — must not include `errors` JSONB (5H-a). */
export const WORKER_RUN_ANALYTICS_SELECT =
  "ok, delivery_enabled, email_provider, reclaimed, scanned, sent, skipped, failed, dry_run, completed_at";

/** Hourly rollup fields for 7d trends — counters only (5H-b). */
export const METRICS_HOURLY_TRENDS_SELECT =
  "bucket_start, run_count, sent_count, failed_count, dry_run_count, live_sent_count, live_failed_count";

async function loadWorkerRunsForAnalytics(
  client: SupabaseClient<Database>,
  now: Date,
): Promise<WorkerRunAnalyticsRow[]> {
  const sinceIso = new Date(
    now.getTime() - NOTIFICATION_ANALYTICS_WINDOW_HOURS * 60 * 60_000,
  ).toISOString();

  const { data, error } = await client
    .from("notification_worker_runs")
    .select(WORKER_RUN_ANALYTICS_SELECT)
    .gte("completed_at", sinceIso);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as WorkerRunAnalyticsRow[];
}

async function loadNotificationTrends7d(
  client: SupabaseClient<Database>,
  now: Date,
): Promise<ReturnType<typeof computeTrends7dFromHourlyBuckets>> {
  const sinceIso = new Date(now.getTime() - 14 * 24 * 60 * 60_000).toISOString();

  const { data, error } = await client
    .from("notification_metrics_hourly")
    .select(METRICS_HOURLY_TRENDS_SELECT)
    .gte("bucket_start", sinceIso)
    .order("bucket_start", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return computeTrends7dFromHourlyBuckets((data ?? []) as NotificationMetricsHourlyBucket[], now);
}

type WorkerRunAnalyticsRow = {
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

async function loadDeliverableTemplateBreakdown(
  client: SupabaseClient<Database>,
  nowIso: string,
  staleIso: string,
): Promise<NotificationDeliverableTemplateRow[]> {
  const statuses: NotificationOutboxStatus[] = ["sent", "failed", "pending", "processing"];

  const rows = await Promise.all(
    DELIVERABLE_NOTIFICATION_SPECS.map(async (spec) => {
      const counts = await Promise.all(
        statuses.map((status) =>
          countOutboxRows(
            client,
            {
              status,
              template: spec.template,
              channel: spec.channel,
            },
            nowIso,
            staleIso,
          ),
        ),
      );

      return {
        template: spec.template,
        channel: spec.channel,
        counts: {
          sent: counts[0] ?? 0,
          failed: counts[1] ?? 0,
          pending: counts[2] ?? 0,
          processing: counts[3] ?? 0,
        },
      };
    }),
  );

  return rows;
}

async function loadUnsupportedTemplateBreakdown(
  client: SupabaseClient<Database>,
  nowIso: string,
  staleIso: string,
): Promise<NotificationUnsupportedTemplateRow[]> {
  return Promise.all(
    UNSUPPORTED_PENDING_TEMPLATES.map(async (template) => ({
      template,
      pending: await countOutboxRows(
        client,
        { status: "pending", template },
        nowIso,
        staleIso,
      ),
    })),
  );
}

export async function loadNotificationAnalytics(
  client: SupabaseClient<Database>,
  summary: NotificationHealthSummary,
  banner: AdminNotificationDeliveryBannerModel,
  now: Date,
): Promise<AdminNotificationAnalytics> {
  const nowIso = now.toISOString();
  const staleMinutes = getProcessingStaleMinutes();
  const staleIso = new Date(now.getTime() - staleMinutes * 60_000).toISOString();

  const [workerRuns, deliverableTemplates, unsupportedTemplates, trends7d] = await Promise.all([
    loadWorkerRunsForAnalytics(client, now),
    loadDeliverableTemplateBreakdown(client, nowIso, staleIso),
    loadUnsupportedTemplateBreakdown(client, nowIso, staleIso),
    loadNotificationTrends7d(client, now),
  ]);

  return {
    worker24h: computeWorker24hAnalytics(workerRuns),
    trends7d,
    queuePressure: computeQueuePressure(summary),
    deliverableTemplates,
    unsupportedTemplates,
    dryRunModeActive: banner.deliveryEnabled && banner.emailProvider === "dry_run",
  };
}

export async function loadRecentNotificationWorkerRuns(
  client: SupabaseClient<Database>,
  now: Date = new Date(),
  limit: number = RECENT_WORKER_RUNS_LIMIT,
): Promise<AdminNotificationWorkerRunListItem[]> {
  const { data, error } = await client
    .from("notification_worker_runs")
    .select(WORKER_RUN_SELECT)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => mapNotificationWorkerRunForAdmin(row, now));
}

export async function loadLatestNotificationWorkerHealth(
  client: SupabaseClient<Database>,
  now: Date = new Date(),
): Promise<AdminNotificationWorkerHealthModel> {
  const { data, error } = await client
    .from("notification_worker_runs")
    .select(WORKER_RUN_SELECT)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    const health = computeWorkerRunHealth(null, now);
    return {
      hasRun: false,
      completedAt: null,
      ageMinutes: health.ageMinutes,
      healthLevel: health.level,
      healthMessage: health.message,
      ok: null,
      deliveryEnabled: null,
      emailProvider: null,
      triggerSource: null,
      reclaimed: null,
      scanned: null,
      sent: null,
      skipped: null,
      failed: null,
      dryRun: null,
      errorCount: null,
    };
  }

  const health = computeWorkerRunHealth(data.completed_at, now);

  return {
    hasRun: true,
    completedAt: data.completed_at,
    ageMinutes: health.ageMinutes,
    healthLevel: health.level,
    healthMessage: health.message,
    ok: data.ok,
    deliveryEnabled: data.delivery_enabled,
    emailProvider: data.email_provider,
    triggerSource: data.trigger_source,
    reclaimed: data.reclaimed,
    scanned: data.scanned,
    sent: data.sent,
    skipped: data.skipped,
    failed: data.failed,
    dryRun: data.dry_run,
    errorCount: data.error_count,
  };
}

function buildDeliveryBanner(): AdminNotificationDeliveryBannerModel {
  const config = getNotificationDeliveryConfig();
  const deliveryEnabled = isNotificationDeliveryEnabled();
  const canRun = canRunNotificationDelivery();

  let emailProvider: AdminNotificationDeliveryBannerModel["emailProvider"] = "disabled";
  if (deliveryEnabled) {
    emailProvider = config.emailProvider;
  }

  let appBaseUrlWarning: string | null = null;
  if (isLocalhostAppBaseUrl(config.appBaseUrl)) {
    appBaseUrlWarning = "APP_BASE_URL resolves to localhost — email links may be wrong in production.";
  }

  return {
    deliveryEnabled,
    canRunDelivery: canRun,
    emailProvider,
    appBaseUrl: config.appBaseUrl,
    appBaseUrlWarning,
    staleProcessingMinutes: getProcessingStaleMinutes(),
  };
}

export function parseNotificationHealthFilters(
  params: Record<string, string | string[] | undefined>,
): NotificationHealthFilters {
  const statusParam = typeof params.status === "string" ? params.status : undefined;
  const deliverableParam =
    typeof params.deliverable === "string" ? params.deliverable : undefined;
  const templateParam = typeof params.template === "string" ? params.template : null;

  const allowedStatuses = new Set<NotificationOutboxStatus>([
    "pending",
    "processing",
    "sent",
    "failed",
  ]);

  let status: NotificationOutboxStatus[];
  if (statusParam) {
    status = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is NotificationOutboxStatus =>
        allowedStatuses.has(s as NotificationOutboxStatus),
      );
  } else {
    status = [...DEFAULT_NEEDS_ATTENTION_STATUSES];
  }

  let deliverable: NotificationDeliverableFilter = "true";
  if (deliverableParam === "false" || deliverableParam === "all") {
    deliverable = deliverableParam;
  }

  return {
    status,
    template: templateParam,
    deliverable,
  };
}

export async function getAdminNotificationHealthPage(
  user: CurrentUser,
  filters: NotificationHealthFilters,
): Promise<
  | { ok: true; page: AdminNotificationHealthPageResult }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const now = new Date();

  const banner = buildDeliveryBanner();
  const summary = await loadNotificationHealthSummary(client, now);

  const [
    oldestActionablePendingAgeMs,
    rows,
    workerHealth,
    recentWorkerRuns,
    analytics,
    retentionDryRun,
  ] = await Promise.all([
    loadOldestActionablePendingAgeMs(client, now),
    listFilteredNotificationRows(client, filters),
    loadLatestNotificationWorkerHealth(client, now),
    loadRecentNotificationWorkerRuns(client, now),
    loadNotificationAnalytics(client, summary, banner, now),
    reportNotificationRetentionDryRun(client, now),
  ]);

  return {
    ok: true,
    page: {
      summary,
      oldestActionablePendingAgeMs,
      rows,
      filters,
      banner,
      analytics,
      workerHealth,
      recentWorkerRuns,
      retentionDryRun,
    },
  };
}

/** @internal Exported for tests — classifies a row without DB. */
export { isDeliverableNotificationRow };
