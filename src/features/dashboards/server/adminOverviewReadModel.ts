import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminOperationalAuditRow, BookingStateAuditRow } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import { countActiveBookingSeries } from "@/features/recurring/bookingSeriesRepository";
import { getDeferredAssignmentConfig } from "@/features/assignments/server/assignmentDispatchConfig";
import { getDeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import { getAdminPayoutSummary } from "@/features/earnings/server/payoutReadModel";
import { loadCronHealthReadModel } from "@/features/operations/server/cronHealthReadModel";
import { summarizeCronHealth } from "@/features/dashboards/adminAssignmentsPageDisplay";
import {
  buildAdminHomeDispatchAlerts,
  buildAdminHomeLiveFeed,
  buildAdminHomeLiveFeedFromEvents,
  buildAdminHomePayoutSummaryView,
  buildAdminHomeRhythmPresentation,
  buildAdminHomeSnapshotPresentation,
  buildAdminHomeSupportQueue,
  buildAdminHomeTodaySnapshotFromCounts,
  formatUpcomingDayLabel,
  mergeAdminHomeLiveFeed,
  withActiveIssuesCount,
  type AdminHomeDisplayContext,
  type AdminHomeDispatchAlert,
  type AdminHomeLiveFeedItem,
  type AdminHomePayoutSummaryView,
  type AdminHomeRhythmPresentation,
  type AdminHomeSnapshotPresentation,
  type AdminHomeSupportRow,
  type AdminHomeTodaySnapshot,
} from "@/features/dashboards/adminHomeOperationsDisplay";
import {
  johannesburgCalendarDayKey,
  johannesburgDayUtcBounds,
} from "@/lib/datetime/johannesburgDay";
import { listAdminAssignmentQueue } from "./adminOperationsReadModel";
import { getAdminOperationalQueueCounts } from "./adminOperationalQueueCounts";
import { ADMIN_HOME_PREVIEW_LIMIT } from "./adminOperationalHelpers";
import {
  mapTeamSupportObservationRow,
  matchesTeamSupportBookingFilter,
  parseAdminOperationalLoadSignals,
  readTeamRequestFulfillment,
  readTeamSupportOps,
  supportingCleanerDisplayLabel,
  teamCoordinationStatusLabel,
  teamRequestFulfillmentLabel,
} from "./adminTeamSupportObservation";
import { formatScheduleRange, parseBookingDisplay } from "./parseBookingDisplay";
import type {
  AdminAssignmentQueueItem,
  AdminBookingListItem,
} from "./types";
import type { AdminOperationalQueueCountItem } from "./adminOperationalQueueCounts";
import type { DeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import type { CronHealthSummary } from "@/features/dashboards/adminAssignmentsPageDisplay";
import type { AdminPayoutSummary } from "@/features/earnings/server/payoutReadModel";
import type { CronJobHealthSnapshot } from "@/features/operations/server/cronHealthTypes";
import {
  loadAdminOverviewOperationalEvents,
  type AdminOverviewOperationalEvent,
} from "./adminOverviewOperationalEvents";

const TODAY_BOOKING_STATUSES_EXCLUDED: readonly BookingStatus[] = ["cancelled", "draft"];

const ACTIVE_CLEANER_STATUSES: readonly BookingStatus[] = [
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
];

const COMPLETED_VISIT_STATUSES: readonly BookingStatus[] = [
  "completed",
  "payout_ready",
  "paid_out",
];

const RECURRING_ACTIVE_STATUSES: readonly BookingStatus[] = [
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
];

const SUPPORT_SCAN_LIMIT = 40;

export type AdminOverviewLoaderResult = {
  referenceNow: string;
  displayContext: AdminHomeDisplayContext;
  queues: AdminOperationalQueueCountItem[];
  cronSummary: CronHealthSummary | null;
  criticalCronJobs: CronJobHealthSnapshot[];
  deferredDiagnostics: DeferredAssignmentDiagnostics | null;
  assignmentWorkQueueTotal: number;
  attention: AdminAssignmentQueueItem[];
  attentionTotal: number;
  snapshot: AdminHomeTodaySnapshot;
  snapshotPresentation: AdminHomeSnapshotPresentation;
  liveFeed: AdminHomeLiveFeedItem[];
  dispatchAlerts: AdminHomeDispatchAlert[];
  supportRows: AdminHomeSupportRow[];
  rhythm: AdminHomeRhythmPresentation;
  payoutView: AdminHomePayoutSummaryView;
};

import type {
  AdminOverviewRhythmCounts,
  AdminOverviewTodayCounts,
  AdminOverviewUpcomingContext,
} from "./adminOverviewTypes";

export type { AdminOverviewRhythmCounts, AdminOverviewTodayCounts } from "./adminOverviewTypes";

type TodayBookingRow = {
  id: string;
  status: BookingStatus;
  cleaner_id: string | null;
  price_cents: number;
  scheduled_start: string;
};

async function resolveCustomerLabel(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  customerId: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(customerId);
  if (cached) return cached;
  const { data } = await client
    .from("customers")
    .select("company_name")
    .eq("id", customerId)
    .maybeSingle();
  const label = data?.company_name?.trim() || "Archived customer";
  cache.set(customerId, label);
  return label;
}

export async function loadAdminOverviewUpcomingContext(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  dayKey: string,
): Promise<AdminOverviewUpcomingContext> {
  const { endExclusiveIso } = johannesburgDayUtcBounds(dayKey);
  const statusNotIn = `(${TODAY_BOOKING_STATUSES_EXCLUDED.map((s) => `"${s}"`).join(",")})`;

  const [
    { count: upcomingCount, error: upcomingCountError },
    { data: nextRow, error: nextError },
    { count: cleanersCount, error: cleanersError },
  ] = await Promise.all([
    client
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_start", endExclusiveIso)
      .not("status", "in", statusNotIn),
    client
      .from("bookings")
      .select("id, scheduled_start")
      .gte("scheduled_start", endExclusiveIso)
      .not("status", "in", statusNotIn)
      .order("scheduled_start", { ascending: true })
      .limit(1)
      .maybeSingle(),
    client.from("cleaners").select("*", { count: "exact", head: true }),
  ]);

  if (upcomingCountError) throw new Error(upcomingCountError.message);
  if (nextError) throw new Error(nextError.message);
  if (cleanersError) throw new Error(cleanersError.message);

  const nextScheduledStart = nextRow?.scheduled_start ?? null;
  const nextUpcomingDayLabel = nextScheduledStart
    ? formatUpcomingDayLabel(nextScheduledStart, dayKey)
    : null;

  let futurePaidBookingsCount = 0;
  if ((upcomingCount ?? 0) > 0) {
    const { data: futureRows, error: futureError } = await client
      .from("bookings")
      .select("id")
      .gte("scheduled_start", endExclusiveIso)
      .not("status", "in", statusNotIn)
      .limit(200);
    if (futureError) throw new Error(futureError.message);

    const futureIds = (futureRows ?? []).map((r) => r.id);
    if (futureIds.length > 0) {
      const { count: paidFuture, error: paidError } = await client
        .from("payments")
        .select("*", { count: "exact", head: true })
        .eq("status", "paid")
        .in("booking_id", futureIds);
      if (paidError) throw new Error(paidError.message);
      futurePaidBookingsCount = paidFuture ?? 0;
    }
  }

  return {
    upcomingBookingsCount: upcomingCount ?? 0,
    nextUpcomingScheduledStart: nextScheduledStart,
    nextUpcomingDayLabel,
    futurePaidBookingsCount,
    cleanersInSystemCount: cleanersCount ?? 0,
  };
}

export async function loadAdminOverviewTodayCounts(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  dayKey: string,
): Promise<AdminOverviewTodayCounts> {
  const { startIso, endExclusiveIso } = johannesburgDayUtcBounds(dayKey);

  const { data: bookingRows, error: bookingsError } = await client
    .from("bookings")
    .select("id, status, cleaner_id, price_cents, scheduled_start")
    .gte("scheduled_start", startIso)
    .lt("scheduled_start", endExclusiveIso);

  if (bookingsError) {
    throw new Error(bookingsError.message);
  }

  const todayRows = (bookingRows ?? []).filter(
    (row) => !TODAY_BOOKING_STATUSES_EXCLUDED.includes(row.status as BookingStatus),
  ) as TodayBookingRow[];

  const cleanersActive = new Set(
    todayRows
      .filter(
        (row) =>
          row.cleaner_id &&
          ACTIVE_CLEANER_STATUSES.includes(row.status as BookingStatus),
      )
      .map((row) => row.cleaner_id as string),
  ).size;

  const bookingsConfirmed = todayRows.filter((row) => row.status === "confirmed").length;
  const bookingsDone = todayRows.filter((row) =>
    COMPLETED_VISIT_STATUSES.includes(row.status as BookingStatus),
  ).length;

  const bookingIds = todayRows.map((row) => row.id);
  let revenueTodayCents = 0;

  if (bookingIds.length > 0) {
    const { data: payments, error: paymentsError } = await client
      .from("payments")
      .select("amount_cents, booking_id, status")
      .eq("status", "paid")
      .in("booking_id", bookingIds);

    if (paymentsError) {
      throw new Error(paymentsError.message);
    }

    revenueTodayCents = (payments ?? []).reduce((sum, payment) => sum + payment.amount_cents, 0);
  }

  return {
    bookingsToday: todayRows.length,
    bookingsConfirmed,
    bookingsDone,
    cleanersActive,
    revenueTodayCents,
  };
}

export async function loadAdminOverviewRhythmCounts(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  dayKey: string,
  attentionNeeded: number,
): Promise<AdminOverviewRhythmCounts> {
  const { startIso, endExclusiveIso } = johannesburgDayUtcBounds(dayKey);

  const [activeSeriesCount, { data: todayRows, error: todayError }] = await Promise.all([
    countActiveBookingSeries(client),
    client
      .from("bookings")
      .select("id, status")
      .gte("scheduled_start", startIso)
      .lt("scheduled_start", endExclusiveIso),
  ]);

  if (todayError) throw new Error(todayError.message);

  const confirmedToday =
    (todayRows ?? []).filter((row) => row.status === "confirmed").length ?? 0;
  const completedVisitsToday =
    (todayRows ?? []).filter((row) =>
      COMPLETED_VISIT_STATUSES.includes(row.status as BookingStatus),
    ).length ?? 0;

  return {
    recurringActive: activeSeriesCount,
    confirmedToday,
    attentionNeeded,
    completedVisitsToday,
  };
}

async function loadAdminOverviewSupportBookings(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
): Promise<AdminBookingListItem[]> {
  const { data: rows, error } = await client
    .from("bookings")
    .select(
      "id, status, customer_id, scheduled_start, scheduled_end, metadata, updated_at, price_cents, currency",
    )
    .order("updated_at", { ascending: false })
    .limit(SUPPORT_SCAN_LIMIT);

  if (error) throw new Error(error.message);

  const customerLabels = new Map<string, string>();
  const items: AdminBookingListItem[] = [];

  for (const row of rows ?? []) {
    const display = parseBookingDisplay(row.metadata);
    const observationRow = mapTeamSupportObservationRow({
      bookingId: row.id,
      priceCents: row.price_cents,
      metadata: row.metadata,
    });

    const hasSupport =
      matchesTeamSupportBookingFilter(observationRow, "team_awaiting_coordination") ||
      matchesTeamSupportBookingFilter(observationRow, "two_cleaner_request") ||
      observationRow.teamSupportOps.teamSupportNotes != null;

    if (!hasSupport) continue;

    const customerLabel = row.customer_id
      ? await resolveCustomerLabel(client, row.customer_id, customerLabels)
      : "Archived customer";
    const teamSupportOps = readTeamSupportOps(row.metadata);
    const teamRequestFulfillment = readTeamRequestFulfillment(row.metadata);
    const isTwoCleanerRequest = display.isTwoCleanerRequest;

    items.push({
      id: row.id,
      status: row.status as BookingStatus,
      paymentStatus: null,
      paymentFailureReason: "none",
      customerLabel,
      cleanerLabel: null,
      serviceLabel: display.serviceLabel,
      scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
      scheduledStart: row.scheduled_start,
      scheduledEnd: row.scheduled_end,
      suburb: display.suburb,
      city: display.city,
      priceLabel: "",
      priceCents: row.price_cents,
      observation: {
        isTwoCleanerRequest,
        operationalLoad: parseAdminOperationalLoadSignals(row.metadata, display.serviceSlug),
        teamRequestFulfillment,
        teamRequestFulfillmentLabel: teamRequestFulfillmentLabel(
          teamRequestFulfillment,
          isTwoCleanerRequest,
        ),
        teamSupportOps,
        supportingCleanerLabel: supportingCleanerDisplayLabel(teamSupportOps.supportingCleaner),
        coordinationStatusLabel: teamCoordinationStatusLabel(
          teamSupportOps.coordinationStatus,
          isTwoCleanerRequest,
        ),
        hasTeamSupportNotes: teamSupportOps.teamSupportNotes != null,
      },
      latestProviderRef: null,
      assignmentAttention: display.assignmentAttention,
      assignmentVisibilityKey: display.assignmentVisibilityKey,
      dispatchNotStarted: false,
      recoveryEligible: false,
      updatedAt: row.updated_at,
    });
  }

  return items;
}

async function loadBookingLabelsForEvents(
  client: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  events: readonly AdminOverviewOperationalEvent[],
): Promise<Map<string, { customerLabel: string; serviceLabel: string; scheduleLabel: string }>> {
  const bookingIds = [...new Set(events.map((e) => e.bookingId).filter(Boolean))] as string[];
  const labels = new Map<string, { customerLabel: string; serviceLabel: string; scheduleLabel: string }>();
  if (bookingIds.length === 0) return labels;

  const { data: rows, error } = await client
    .from("bookings")
    .select("id, customer_id, scheduled_start, scheduled_end, metadata")
    .in("id", bookingIds);

  if (error) throw new Error(error.message);

  const customerCache = new Map<string, string>();
  for (const row of rows ?? []) {
    const display = parseBookingDisplay(row.metadata);
    labels.set(row.id, {
      customerLabel: await resolveCustomerLabel(client, row.customer_id, customerCache),
      serviceLabel: display.serviceLabel,
      scheduleLabel: formatScheduleRange(row.scheduled_start, row.scheduled_end),
    });
  }
  return labels;
}

export async function adminOverviewLoader(
  user: CurrentUser,
): Promise<
  | { ok: true; data: AdminOverviewLoaderResult }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return { ok: false, code: "AUTH_NOT_CONFIGURED", message: "Supabase not configured.", status: 503 };
  }

  const referenceNow = new Date().toISOString();
  const displayContext: AdminHomeDisplayContext = { referenceNow };
  const dayKey = johannesburgCalendarDayKey(new Date(referenceNow));
  const deferredConfig = getDeferredAssignmentConfig();

  const [
    queueCounts,
    queue,
    cronHealth,
    deferredDiagnostics,
    payoutSummary,
    todayCounts,
    operationalEvents,
  ] = await Promise.all([
    getAdminOperationalQueueCounts(user),
    listAdminAssignmentQueue(user),
    loadCronHealthReadModel(client),
    getDeferredAssignmentDiagnostics(client, { deferredEnabled: deferredConfig.enabled }),
    getAdminPayoutSummary(user),
    loadAdminOverviewTodayCounts(client, dayKey),
    loadAdminOverviewOperationalEvents(client),
  ]);

  if (!queueCounts.ok) {
    return {
      ok: false,
      code: queueCounts.code,
      message: queueCounts.message,
      status: queueCounts.status,
    };
  }

  const attention = queue?.ok ? queue.items.slice(0, ADMIN_HOME_PREVIEW_LIMIT) : [];
  const attentionTotal = queue?.ok ? queue.total : 0;
  const assignmentAttention =
    queueCounts.queues.find((q) => q.key === "assignment_attention")?.count ?? 0;

  const [rhythmCounts, bookingLabels, supportBookings, upcomingContext] = await Promise.all([
    loadAdminOverviewRhythmCounts(client, dayKey, assignmentAttention),
    loadBookingLabelsForEvents(client, operationalEvents),
    loadAdminOverviewSupportBookings(client),
    loadAdminOverviewUpcomingContext(client, dayKey),
  ]);

  const cronSummary = cronHealth ? summarizeCronHealth(cronHealth.jobs) : null;

  const snapshot = withActiveIssuesCount(
    buildAdminHomeTodaySnapshotFromCounts(todayCounts),
    {
      queues: queueCounts.queues,
      cronSummary,
      deferredDiagnostics,
    },
  );

  const matchingPending = queueCounts.queues.find((q) => q.key === "needs_assignment")?.count ?? 0;
  const snapshotPresentation = buildAdminHomeSnapshotPresentation({
    snapshot,
    upcoming: upcomingContext,
    matchingPending,
    recurringActive: rhythmCounts.recurringActive,
  });

  const eventFeed = buildAdminHomeLiveFeedFromEvents({
    events: operationalEvents,
    bookingLabels,
    limit: 8,
    context: displayContext,
  });

  const legacyFeed =
    attention.length > 0
      ? buildAdminHomeLiveFeed({
          attention,
          bookings: [],
          limit: 8,
          context: displayContext,
        })
      : [];

  const liveFeed = mergeAdminHomeLiveFeed(eventFeed, legacyFeed, 8);

  const dispatchAlerts = buildAdminHomeDispatchAlerts({
    queues: queueCounts.queues,
    attention,
    deferredDiagnostics,
    limit: 4,
  });

  const supportRows = buildAdminHomeSupportQueue(supportBookings, 3, displayContext);
  const rhythm = buildAdminHomeRhythmPresentation(rhythmCounts, attentionTotal);
  const payoutView = buildAdminHomePayoutSummaryView(
    payoutSummary?.ok ? payoutSummary.summary : null,
  );

  return {
    ok: true,
    data: {
      referenceNow,
      displayContext,
      queues: queueCounts.queues,
      cronSummary,
      criticalCronJobs: cronSummary?.criticalJobs ?? [],
      deferredDiagnostics,
      assignmentWorkQueueTotal: attentionTotal,
      attention,
      attentionTotal,
      snapshot,
      snapshotPresentation,
      liveFeed,
      dispatchAlerts,
      supportRows,
      rhythm,
      payoutView,
    },
  };
}
