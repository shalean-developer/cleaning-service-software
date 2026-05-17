import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import { isLocalhostAppBaseUrl } from "@/lib/app/appBaseUrl";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, NotificationOutboxStatus } from "@/lib/database/types";
import {
  buildDeliverableOutboxTemplateOrFilter,
  canRunNotificationDelivery,
  getNotificationDeliveryConfig,
  getProcessingStaleMinutes,
  isNotificationDeliveryEnabled,
} from "./config";
import { mapNotificationOutboxRowForAdmin } from "./mapNotificationOutboxRowForAdmin";
import { findOldestActionablePendingAgeMs } from "./notificationAdminAggregates";
import type {
  AdminNotificationDeliveryBannerModel,
  AdminNotificationHealthPageResult,
  NotificationDeliverableFilter,
  NotificationHealthFilters,
  NotificationHealthSummary,
} from "./notificationAdminTypes";
import { ADMIN_NOTIFICATION_GLOBAL_LIST_LIMIT } from "./notificationAdminTypes";
import { isDeliverableNotificationRow } from "./notificationOutboxDeliverability";

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

  let rows = (data ?? []).map((row) => mapNotificationOutboxRowForAdmin(row));

  if (filters.deliverable === "all") {
    return rows;
  }

  if (filters.deliverable === "false") {
    return rows.filter((r) => !r.isDeliverable);
  }

  return rows.filter((r) => r.isDeliverable);
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

  const [summary, oldestActionablePendingAgeMs, rows] = await Promise.all([
    loadNotificationHealthSummary(client, now),
    loadOldestActionablePendingAgeMs(client, now),
    listFilteredNotificationRows(client, filters),
  ]);

  return {
    ok: true,
    page: {
      summary,
      oldestActionablePendingAgeMs,
      rows,
      filters,
      banner: buildDeliveryBanner(),
    },
  };
}

/** @internal Exported for tests — classifies a row without DB. */
export { isDeliverableNotificationRow };
