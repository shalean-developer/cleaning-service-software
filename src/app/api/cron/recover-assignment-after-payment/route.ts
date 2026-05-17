import { NextResponse } from "next/server";
import { runAssignmentRecoveryBatch } from "@/features/assignments/server/runAssignmentRecovery";
import { verifyCronSecret } from "@/lib/cron/verifyCronSecret";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";

export const runtime = "nodejs";

/**
 * Recovers paid bookings stuck in `confirmed` without assignment dispatch.
 * GET/POST with Authorization: Bearer $CRON_SECRET or x-cron-secret header.
 * See docs/operations/assignment-recovery.md
 */
async function handleRecover(request: Request) {
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

  try {
    const backend = createBookingCommandBackend();
    const result = await runAssignmentRecoveryBatch(client, backend);

    return NextResponse.json({
      ok: true,
      candidateCount: result.candidateCount,
      attemptedCount: result.attemptedCount,
      recoveredBookingIds: result.recoveredBookingIds,
      skippedBookingIds: result.skippedBookingIds,
      failed: result.failed,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Assignment recovery failed.";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleRecover(request);
}

export async function POST(request: Request) {
  return handleRecover(request);
}
