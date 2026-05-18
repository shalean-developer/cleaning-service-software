import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isOfferOpenForOps } from "./buildOfferExpiry";
import { shouldRunAssignmentNow, isAssignmentDeferred } from "./computeAssignmentDispatchAt";
import { DEFERRED_DISPATCH_OVERDUE_GRACE_MINUTES } from "./constants";
import { listOffersForBooking } from "./offerRepository";

export type DeferredAssignmentDiagnostics = {
  deferredAssignmentEnabled: boolean;
  awaitingDispatchWindowCount: number;
  readyForDispatchCount: number;
  overdueDispatchCount: number;
  oldestOverdueDispatchAt: string | null;
  lastCronRun: {
    completedAt: string;
    ok: boolean;
    triggerSource: string;
    candidateCount: number;
    attemptedCount: number;
    dispatchedCount: number;
    skippedCount: number;
    failedCount: number;
  } | null;
};

async function countDeferredBookingsByPhase(
  client: SupabaseClient<Database>,
  now: Date,
): Promise<{
  awaiting: number;
  ready: number;
  overdue: number;
  oldestOverdueDispatchAt: string | null;
}> {
  const { data: bookings, error } = await client
    .from("bookings")
    .select("id, status, cleaner_id, assignment_dispatch_at, scheduled_start")
    .eq("status", "confirmed")
    .not("assignment_dispatch_at", "is", null);

  if (error) throw new Error(error.message);

  let awaiting = 0;
  let ready = 0;
  let overdue = 0;
  let oldestOverdueMs: number | null = null;
  let oldestOverdueDispatchAt: string | null = null;

  for (const booking of bookings ?? []) {
    if (booking.cleaner_id || !booking.assignment_dispatch_at) continue;

    const offers = await listOffersForBooking(client, booking.id);
    if (offers.some((o) => o.status === "accepted")) continue;
    if (offers.some((o) => isOfferOpenForOps(o, now))) continue;

    const { count: paidCount, error: payErr } = await client
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("booking_id", booking.id)
      .eq("status", "paid");
    if (payErr) throw new Error(payErr.message);
    if ((paidCount ?? 0) === 0) continue;

    const dispatchAt = booking.assignment_dispatch_at;

    if (isAssignmentDeferred(dispatchAt, now)) {
      awaiting += 1;
      continue;
    }

    if (!shouldRunAssignmentNow(dispatchAt, now)) continue;

    const dispatchMs = Date.parse(dispatchAt);
    const overdueThresholdMs =
      dispatchMs + DEFERRED_DISPATCH_OVERDUE_GRACE_MINUTES * 60_000;

    if (now.getTime() >= overdueThresholdMs) {
      overdue += 1;
      if (oldestOverdueMs == null || dispatchMs < oldestOverdueMs) {
        oldestOverdueMs = dispatchMs;
        oldestOverdueDispatchAt = dispatchAt;
      }
    } else {
      ready += 1;
    }
  }

  return { awaiting, ready, overdue, oldestOverdueDispatchAt };
}

export async function getDeferredAssignmentDiagnostics(
  client: SupabaseClient<Database>,
  options: { now?: Date; deferredEnabled?: boolean } = {},
): Promise<DeferredAssignmentDiagnostics> {
  const now = options.now ?? new Date();
  const counts = await countDeferredBookingsByPhase(client, now);

  const { data: lastRun, error: runErr } = await client
    .from("deferred_dispatch_cron_runs")
    .select(
      "completed_at, ok, trigger_source, candidate_count, attempted_count, dispatched_count, skipped_count, failed_count",
    )
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runErr) throw new Error(runErr.message);

  return {
    deferredAssignmentEnabled: options.deferredEnabled ?? false,
    awaitingDispatchWindowCount: counts.awaiting,
    readyForDispatchCount: counts.ready,
    overdueDispatchCount: counts.overdue,
    oldestOverdueDispatchAt: counts.oldestOverdueDispatchAt,
    lastCronRun: lastRun
      ? {
          completedAt: lastRun.completed_at,
          ok: lastRun.ok,
          triggerSource: lastRun.trigger_source,
          candidateCount: lastRun.candidate_count,
          attemptedCount: lastRun.attempted_count,
          dispatchedCount: lastRun.dispatched_count,
          skippedCount: lastRun.skipped_count,
          failedCount: lastRun.failed_count,
        }
      : null,
  };
}
