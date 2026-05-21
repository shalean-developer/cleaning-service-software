import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingSeriesRow } from "@/lib/database/types";
import { RECURRING_GENERATION_HORIZON_DAYS } from "../types";
import {
  buildRecurringIntegrityAlerts,
  deriveOverallRecurringHealth,
  RECURRING_HEALTH_CONSTANTS,
} from "./recurringIntegrityChecks";
import { countOpenRecurringSeriesRequests } from "./recurringSeriesRequestsService";
import {
  cronRunAgeWarning,
  deriveLaunchReadinessLevel,
  evaluateRequiredEnvForLaunch,
  RECURRING_LAUNCH_REQUIRED_ENV,
} from "./recurringLaunchReadiness";
import type {
  RecurringHealthReadModel,
  RecurringHealthSummary,
  RecurringSeriesAuditEvent,
  RecurringSeriesHealthRow,
} from "./recurringHealthTypes";

const MS_PER_DAY = 86_400_000;
const PAYMENT_REQUIRED_STATUSES = ["pending_payment", "draft", "payment_failed"] as const;

export type RecurringHealthReadModelResult =
  | { ok: true; model: RecurringHealthReadModel }
  | { ok: false; message: string };

function countByStatus(series: BookingSeriesRow[]): {
  active: number;
  paused: number;
  cancelled: number;
} {
  let active = 0;
  let paused = 0;
  let cancelled = 0;
  for (const s of series) {
    if (s.status === "active") active += 1;
    else if (s.status === "paused") paused += 1;
    else if (s.status === "cancelled") cancelled += 1;
  }
  return { active, paused, cancelled };
}

export async function loadRecurringHealthReadModel(
  user: CurrentUser,
  options: { now?: Date } = {},
): Promise<RecurringHealthReadModelResult> {
  if (user.role !== "admin") {
    return { ok: false, message: "Admin access required." };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, message: "Database not configured." };
  }

  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const horizonEnd = new Date(nowMs + RECURRING_GENERATION_HORIZON_DAYS * MS_PER_DAY).toISOString();

  const { data: seriesRows, error: seriesError } = await client
    .from("booking_series")
    .select(
      "id, customer_id, status, frequency, next_occurrence_at, created_from_booking_id, updated_at, anchor_scheduled_start, group_id, weekday",
    )
    .order("updated_at", { ascending: false })
    .limit(RECURRING_HEALTH_CONSTANTS.MAX_SERIES_ROWS);
  if (seriesError) return { ok: false, message: seriesError.message };

  const series = (seriesRows ?? []) as BookingSeriesRow[];
  const statusCounts = countByStatus(series);

  const { data: childBookings, error: bookingsError } = await client
    .from("bookings")
    .select("id, customer_id, series_id, status, scheduled_start, price_cents, metadata, created_at")
    .not("series_id", "is", null)
    .gte("scheduled_start", now.toISOString())
    .lte("scheduled_start", horizonEnd)
    .order("scheduled_start", { ascending: true })
    .limit(RECURRING_HEALTH_CONSTANTS.MAX_BOOKING_ROWS);
  if (bookingsError) return { ok: false, message: bookingsError.message };

  const { data: unpaidBookings, error: unpaidError } = await client
    .from("bookings")
    .select("id, customer_id, series_id, status, scheduled_start, price_cents, metadata, created_at")
    .not("series_id", "is", null)
    .in("status", [...PAYMENT_REQUIRED_STATUSES])
    .order("created_at", { ascending: true })
    .limit(100);
  if (unpaidError) return { ok: false, message: unpaidError.message };

  const allBookingIds = [
    ...new Set([
      ...(childBookings ?? []).map((b) => b.id as string),
      ...(unpaidBookings ?? []).map((b) => b.id as string),
    ]),
  ];

  const paidBookingIds = new Set<string>();
  if (allBookingIds.length > 0) {
    const { data: payments } = await client
      .from("payments")
      .select("booking_id")
      .in("booking_id", allBookingIds)
      .eq("status", "paid");
    for (const p of payments ?? []) {
      if (p.booking_id) paidBookingIds.add(p.booking_id as string);
    }
  }

  const { data: auditRows } = await client
    .from("booking_state_audit")
    .select("booking_id, command, actor_type, created_at, metadata")
    .like("command", "RECURRING_%")
    .order("created_at", { ascending: false })
    .limit(RECURRING_HEALTH_CONSTANTS.MAX_AUDIT_ROWS);

  const { data: runRows } = await client
    .from("recurring_generation_runs")
    .select("id, run_id, completed_at, status, children_generated, failures_count")
    .order("completed_at", { ascending: false })
    .limit(RECURRING_HEALTH_CONSTANTS.MAX_RUN_ROWS);

  const bookingsForIntegrity = [
    ...(childBookings ?? []),
    ...(unpaidBookings ?? []).filter(
      (b) => !(childBookings ?? []).some((c) => c.id === b.id),
    ),
  ].map((b) => ({
    id: b.id as string,
    customer_id: b.customer_id as string,
    series_id: b.series_id as string | null,
    status: b.status as string,
    scheduled_start: b.scheduled_start as string,
    price_cents: b.price_cents as number | undefined,
    metadata: (b.metadata ?? null) as Record<string, unknown> | null,
    created_at: b.created_at as string,
  }));

  const { data: groupRows } = await client
    .from("recurring_schedule_groups")
    .select("id, customer_id, status, frequency, selected_days, anchor_booking_id")
    .limit(RECURRING_HEALTH_CONSTANTS.MAX_SERIES_ROWS);

  const alerts = [
    ...buildRecurringIntegrityAlerts({
      seriesRows: series,
      bookings: bookingsForIntegrity,
      paidBookingIds,
      nowMs,
    }),
    ...(await import("./recurringGroupIntegrityChecks")).buildRecurringGroupIntegrityAlerts({
      groups: (groupRows ?? []) as import("@/lib/database/types").RecurringScheduleGroupRow[],
      seriesRows: series,
    }),
  ];

  const staleNextOccurrenceCount = series.filter(
    (s) =>
      s.status === "active" &&
      s.next_occurrence_at &&
      new Date(s.next_occurrence_at).getTime() < nowMs - RECURRING_HEALTH_CONSTANTS.STALE_NEXT_MS,
  ).length;

  const paymentRequiredChildrenCount = (unpaidBookings ?? []).length;
  const overdueUnpaidChildrenCount = alerts.filter((a) => a.code === "OVERDUE_PAYMENT_REQUIRED").length;
  const failedGenerationRiskCount = staleNextOccurrenceCount + alerts.filter((a) => a.code === "PAUSED_SERIES_NEW_CHILD").length;
  const cleanerVisibilityRiskCount = alerts.filter(
    (a) => a.code === "UNPAID_CHILD_CLEANER_VISIBLE",
  ).length;
  const openSupportRequestsCount = await countOpenRecurringSeriesRequests(client);

  const latestRun = (runRows ?? [])[0];
  const cronLastRunAgeHours = latestRun?.completed_at
    ? Math.round((nowMs - new Date(latestRun.completed_at as string).getTime()) / (60 * 60 * 1000))
    : null;

  const envReadiness = RECURRING_LAUNCH_REQUIRED_ENV.map((key) => ({
    key,
    ok: Boolean(process.env[key]?.trim()),
  }));
  const missingRequiredEnv = envReadiness.some((e) => !e.ok);
  const hasCriticalAlerts = alerts.some((a) => a.severity === "critical");
  const hasWarnings = alerts.some((a) => a.severity === "warning");
  const launchReadiness = deriveLaunchReadinessLevel({
    hasCriticalAlerts: hasCriticalAlerts || cleanerVisibilityRiskCount > 0,
    hasWarnings: hasWarnings || (cronRunAgeWarning(cronLastRunAgeHours)?.level === "WARN"),
    missingRequiredEnv,
  });

  const launchBlockers: string[] = [];
  const launchRecommendations: string[] = [];
  for (const e of evaluateRequiredEnvForLaunch(process.env)) {
    launchBlockers.push(e.message);
  }
  for (const a of alerts.filter((x) => x.severity === "critical")) {
    launchBlockers.push(`${a.code}: ${a.message}`);
  }
  const cronWarn = cronRunAgeWarning(cronLastRunAgeHours);
  if (cronWarn) launchRecommendations.push(cronWarn.message);
  if (openSupportRequestsCount > 0) {
    launchRecommendations.push(
      `${openSupportRequestsCount} open customer recurring request(s) need admin action.`,
    );
  }
  if (overdueUnpaidChildrenCount > 0) {
    launchRecommendations.push(
      `${overdueUnpaidChildrenCount} overdue unpaid recurring visit(s) need payment follow-up.`,
    );
  }

  const summary: RecurringHealthSummary = {
    activeSeriesCount: statusCounts.active,
    pausedSeriesCount: statusCounts.paused,
    cancelledSeriesCount: statusCounts.cancelled,
    childrenGeneratedNext45Days: (childBookings ?? []).filter((b) => {
      const meta = (b.metadata ?? {}) as Record<string, unknown>;
      const recurring = meta.recurring as Record<string, unknown> | undefined;
      return recurring?.generated === true;
    }).length,
    paymentRequiredChildrenCount,
    overdueUnpaidChildrenCount,
    staleNextOccurrenceCount,
    failedGenerationRiskCount,
    auditIssuesCount: alerts.length,
    overallStatus: deriveOverallRecurringHealth(alerts),
    launchReadiness,
    openSupportRequestsCount,
    cleanerVisibilityRiskCount,
    cronLastRunAgeHours,
    cronLastRunStatus: (latestRun?.status as string) ?? null,
    rlsVisibilityStatus: seriesError ? "warn" : "ok",
    envReadiness,
  };

  const childCountBySeries = new Map<string, number>();
  const unpaidBySeries = new Map<string, number>();
  for (const b of bookingsForIntegrity) {
    if (!b.series_id) continue;
    childCountBySeries.set(b.series_id, (childCountBySeries.get(b.series_id) ?? 0) + 1);
    if (PAYMENT_REQUIRED_STATUSES.includes(b.status as (typeof PAYMENT_REQUIRED_STATUSES)[number])) {
      unpaidBySeries.set(b.series_id, (unpaidBySeries.get(b.series_id) ?? 0) + 1);
    }
  }

  const seriesHealth: RecurringSeriesHealthRow[] = series.map((s) => ({
    seriesId: s.id,
    customerId: s.customer_id,
    frequency: s.frequency,
    status: s.status,
    nextOccurrenceAt: s.next_occurrence_at,
    staleNextOccurrence: Boolean(
      s.status === "active" &&
        s.next_occurrence_at &&
        new Date(s.next_occurrence_at).getTime() <
          nowMs - RECURRING_HEALTH_CONSTANTS.STALE_NEXT_MS,
    ),
    childCount: childCountBySeries.get(s.id) ?? 0,
    unpaidChildCount: unpaidBySeries.get(s.id) ?? 0,
  }));

  const staleOrRiskySeries = seriesHealth.filter(
    (r) => r.staleNextOccurrence || r.unpaidChildCount > 0 || r.status !== "active",
  );

  const paymentRequiredBookings = (unpaidBookings ?? []).map((b) => {
    const createdMs = new Date(b.created_at as string).getTime();
    const ageHours = Math.round((nowMs - createdMs) / (60 * 60 * 1000));
    return {
      bookingId: b.id as string,
      seriesId: b.series_id as string,
      scheduledStart: b.scheduled_start as string,
      status: b.status as string,
      ageHours,
      overdue: ageHours >= 48,
    };
  });

  const anchorToSeries = new Map(series.map((s) => [s.created_from_booking_id, s.id]));

  const recentAuditEvents: RecurringSeriesAuditEvent[] = (auditRows ?? [])
    .map((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const recurringSeries = meta.recurringSeries as Record<string, unknown> | undefined;
      const seriesId =
        (typeof recurringSeries?.seriesId === "string" ? recurringSeries.seriesId : null) ??
        anchorToSeries.get(row.booking_id as string) ??
        null;
      if (!seriesId) return null;
      return {
        seriesId,
        anchorBookingId: row.booking_id as string,
        action: row.command as string,
        actorType: row.actor_type as string,
        createdAt: row.created_at as string,
      };
    })
    .filter((e): e is RecurringSeriesAuditEvent => e != null);

  return {
    ok: true,
    model: {
      generatedAt: now.toISOString(),
      launchBlockers,
      launchRecommendations,
      summary,
      alerts,
      seriesHealth,
      staleOrRiskySeries,
      paymentRequiredBookings,
      latestGenerationRuns: (runRows ?? []).map((r) => ({
        id: r.id as string,
        runId: r.run_id as string,
        completedAt: r.completed_at as string,
        status: r.status as string,
        childrenGenerated: r.children_generated as number,
        failuresCount: r.failures_count as number,
      })),
      recentAuditEvents,
    },
  };
}
