import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDeferredAssignmentConfig } from "@/features/assignments/server/assignmentDispatchConfig";
import { getDeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import { loadCronHealthReadModel } from "@/features/operations/server/cronHealthReadModel";
import {
  buildAdminHomeDispatchAlerts,
  type AdminHomeDispatchAlert,
} from "@/features/dashboards/adminHomeOperationsDisplay";
import {
  buildDispatchOrchestrationJobCard,
  buildDispatchOrchestrationSummary,
  buildDispatchSuggestedMatch,
  groupDispatchJobsIntoLanes,
  type DispatchOrchestrationLaneSection,
  type DispatchOrchestrationSummary,
  type DispatchSuggestedMatch,
} from "@/features/dashboards/adminDispatchOrchestrationDisplay";
import {
  summarizeCronHealth,
  type CronHealthSummary,
} from "@/features/dashboards/adminAssignmentsPageDisplay";
import { getAdminOperationalQueueCounts } from "@/features/dashboards/server/adminOperationalQueueCounts";
import {
  listAdminAssignmentQueue,
  listAdminBookings,
} from "@/features/dashboards/server/adminOperationsReadModel";
import { loadAdminOverviewTodayCounts } from "@/features/dashboards/server/adminOverviewReadModel";
import type { AdminAssignmentQueueItem } from "@/features/dashboards/server/types";
import type { AdminOverviewTodayCounts } from "@/features/dashboards/server/adminOverviewTypes";
import type { DeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import { johannesburgCalendarDayKey } from "@/lib/datetime/johannesburgDay";

const DISPATCH_DAY_BOOKING_STATUSES = [
  "pending_assignment",
  "confirmed",
  "assigned",
  "in_progress",
] as const;

export type AdminDispatchOrchestrationData = {
  referenceNow: string;
  summary: DispatchOrchestrationSummary;
  alerts: AdminHomeDispatchAlert[];
  lanes: DispatchOrchestrationLaneSection[];
  suggestedMatch: DispatchSuggestedMatch;
  workQueue: AdminAssignmentQueueItem[];
  workQueueTotal: number;
  today: AdminOverviewTodayCounts;
  queues: Awaited<ReturnType<typeof getAdminOperationalQueueCounts>> extends { ok: true; queues: infer Q }
    ? Q
    : never;
  cronSummary: CronHealthSummary | null;
  deferredDiagnostics: DeferredAssignmentDiagnostics | null;
};

export async function loadAdminDispatchOrchestration(
  user: CurrentUser,
): Promise<
  | { ok: true; data: AdminDispatchOrchestrationData }
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
  const dayKey = johannesburgCalendarDayKey(new Date(referenceNow));
  const deferredConfig = getDeferredAssignmentConfig();

  const [queueCounts, assignmentQueue, cronHealth, deferredDiagnostics, todayCounts, todayBookingsResult] =
    await Promise.all([
      getAdminOperationalQueueCounts(user),
      listAdminAssignmentQueue(user),
      loadCronHealthReadModel(client),
      getDeferredAssignmentDiagnostics(client, { deferredEnabled: deferredConfig.enabled }),
      loadAdminOverviewTodayCounts(client, dayKey),
      listAdminBookings(user, { scheduledFrom: dayKey, scheduledTo: dayKey }),
    ]);

  if (!queueCounts.ok) {
    return {
      ok: false,
      code: queueCounts.code,
      message: queueCounts.message,
      status: queueCounts.status,
    };
  }

  const workQueue = assignmentQueue.ok ? assignmentQueue.items : [];
  const workQueueTotal = assignmentQueue.ok ? assignmentQueue.total : 0;
  const queueByBookingId = new Map(workQueue.map((item) => [item.bookingId, item]));

  const todayBookings = (todayBookingsResult.ok ? todayBookingsResult.bookings : []).filter((booking) =>
    DISPATCH_DAY_BOOKING_STATUSES.includes(
      booking.status as (typeof DISPATCH_DAY_BOOKING_STATUSES)[number],
    ),
  );

  const scheduledStarts = new Map(
    todayBookings.map((booking) => [booking.id, booking.scheduledStart]),
  );

  const jobCards = todayBookings.map((booking) =>
    buildDispatchOrchestrationJobCard(booking, queueByBookingId.get(booking.id)),
  );

  const lanes = groupDispatchJobsIntoLanes(jobCards, scheduledStarts);
  const summary = buildDispatchOrchestrationSummary({
    today: todayCounts,
    queues: queueCounts.queues,
    workQueueCount: workQueue.length,
    laneJobCount: jobCards.length,
  });

  const alerts = buildAdminHomeDispatchAlerts({
    queues: queueCounts.queues,
    attention: workQueue,
    deferredDiagnostics,
    limit: 4,
  });

  const suggestedMatch = buildDispatchSuggestedMatch({
    attention: workQueue,
    todayBookings,
  });

  const cronSummary = cronHealth ? summarizeCronHealth(cronHealth.jobs) : null;

  return {
    ok: true,
    data: {
      referenceNow,
      summary,
      alerts,
      lanes,
      suggestedMatch,
      workQueue,
      workQueueTotal,
      today: todayCounts,
      queues: queueCounts.queues,
      cronSummary,
      deferredDiagnostics,
    },
  };
}
