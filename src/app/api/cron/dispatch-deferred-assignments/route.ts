import { NextResponse } from "next/server";
import { recordDeferredDispatchCronRun } from "@/features/assignments/server/recordDeferredDispatchCronRun";
import { runDeferredAssignmentDispatchBatch } from "@/features/assignments/server/runDeferredAssignmentDispatch";
import { verifyCronSecret } from "@/lib/cron/verifyCronSecret";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";

export const runtime = "nodejs";

/**
 * Dispatches post-payment assignment for confirmed bookings past assignment_dispatch_at.
 * GET/POST with Authorization: Bearer $CRON_SECRET or x-cron-secret header.
 * See docs/operations/dispatch-deferred-assignments-cron.md
 */
async function handleDispatch(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Invalid or missing cron secret." },
      { status: 401 },
    );
  }

  const client = createServiceRoleClient();
  if (!client) {
    return NextResponse.json(
      {
        ok: false,
        error: "AUTH_NOT_CONFIGURED",
        message: "Service role client not configured.",
      },
      { status: 503 },
    );
  }

  const startedAt = new Date();

  try {
    const backend = createBookingCommandBackend();
    const result = await runDeferredAssignmentDispatchBatch(client, backend);
    const completedAt = new Date();

    await recordDeferredDispatchCronRun(client, {
      startedAt,
      completedAt,
      ok: true,
      request,
      result,
    });

    return NextResponse.json({
      ok: true,
      ranAt: completedAt.toISOString(),
      candidateCount: result.candidateCount,
      attemptedCount: result.attemptedCount,
      dispatchedCount: result.dispatchedBookingIds.length,
      skippedCount: result.skippedBookingIds.length,
      failedCount: result.failed.length,
      dispatchedBookingIds: result.dispatchedBookingIds,
      skippedBookingIds: result.skippedBookingIds,
      failed: result.failed,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Deferred assignment dispatch failed.";
    const completedAt = new Date();
    await recordDeferredDispatchCronRun(client, {
      startedAt,
      completedAt,
      ok: false,
      request,
      result: {
        candidateCount: 0,
        attemptedCount: 0,
        dispatchedBookingIds: [],
        skippedBookingIds: [],
        failed: [{ bookingId: "n/a", code: "INTERNAL_ERROR", message }],
      },
    });
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message, ranAt: completedAt.toISOString() },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleDispatch(request);
}

export async function POST(request: Request) {
  return handleDispatch(request);
}
