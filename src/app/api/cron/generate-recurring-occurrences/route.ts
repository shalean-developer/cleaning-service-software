import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { generateRecurringOccurrences } from "@/features/recurring/generateRecurringOccurrences";
import {
  deriveRecurringGenerationRunStatus,
  logRecurringGenerationRunConsole,
  recordRecurringGenerationRun,
} from "@/features/recurring/server/recordRecurringGenerationRun";
import { verifyCronSecret } from "@/lib/cron/verifyCronSecret";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";

/**
 * Generates unpaid child bookings for active recurring series within the horizon.
 * GET/POST with Authorization: Bearer $CRON_SECRET or x-cron-secret header.
 * See docs/operations/generate-recurring-occurrences-cron.md
 */
async function handleGenerate(request: Request) {
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

  const runId = randomUUID();
  const startedAt = new Date();

  try {
    const backend = createBookingCommandBackend();
    const result = await generateRecurringOccurrences(client, backend);
    const completedAt = new Date();
    const status = deriveRecurringGenerationRunStatus(result, true);

    logRecurringGenerationRunConsole({
      runId,
      startedAt,
      completedAt,
      status,
      result,
    });

    await recordRecurringGenerationRun(client, {
      runId,
      startedAt,
      completedAt,
      status,
      result,
      errorMessages: result.errorMessages,
    });

    return NextResponse.json({
      ok: true,
      runId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      status,
      seriesScanned: result.seriesScanned,
      created: result.created,
      skippedExisting: result.skippedExisting,
      skippedAnchor: result.skippedAnchor,
      skippedPaused: result.skippedPaused,
      skippedCancelled: result.skippedCancelled,
      errors: result.errors,
      errorMessages: result.errorMessages,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Recurring occurrence generation failed.";
    const completedAt = new Date();
    const emptyResult = {
      seriesScanned: 0,
      created: 0,
      skippedExisting: 0,
      skippedAnchor: 0,
      skippedPaused: 0,
      skippedCancelled: 0,
      errors: 1,
      errorMessages: [message],
    };
    const status = deriveRecurringGenerationRunStatus(emptyResult, false);

    logRecurringGenerationRunConsole({
      runId,
      startedAt,
      completedAt,
      status,
      result: emptyResult,
      errorMessages: [message],
    });

    await recordRecurringGenerationRun(client, {
      runId,
      startedAt,
      completedAt,
      status,
      result: emptyResult,
      errorMessages: [message],
    });

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message,
        runId,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleGenerate(request);
}

export async function POST(request: Request) {
  return handleGenerate(request);
}
