import { NextResponse } from "next/server";
import {
  backfillAssignmentMetricsHourly,
  isAssignmentMetricsRollupEnabled,
  rollupAssignmentMetricsHourly,
} from "@/features/assignments/server/rollupAssignmentMetricsHourly";
import { ASSIGNMENT_METRICS_MAX_BACKFILL_HOURS } from "@/features/assignments/server/assignmentMetricsHourlyUtc";
import { verifyCronSecret } from "@/lib/cron/verifyCronSecret";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";

const MAX_BACKFILL_HOURS_PER_REQUEST = 24;

async function parseRequestOptions(request: Request): Promise<{
  bucketStart: string | null;
  backfillHours: number | null;
}> {
  const url = new URL(request.url);
  const bucketStart =
    url.searchParams.get("bucketStart") ?? url.searchParams.get("bucket_start");

  let backfillHours: number | null = null;
  const backfillParam = url.searchParams.get("backfillHours");
  if (backfillParam) {
    const parsed = Number.parseInt(backfillParam, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      backfillHours = Math.min(parsed, MAX_BACKFILL_HOURS_PER_REQUEST);
    }
  }

  if (request.method === "POST") {
    try {
      const body = (await request.json()) as {
        bucketStart?: string;
        backfillHours?: number;
      };
      if (body.bucketStart) {
        return { bucketStart: body.bucketStart, backfillHours };
      }
      if (body.backfillHours && Number.isFinite(body.backfillHours)) {
        backfillHours = Math.min(
          Math.max(1, Math.floor(body.backfillHours)),
          MAX_BACKFILL_HOURS_PER_REQUEST,
        );
      }
    } catch {
      // ignore invalid JSON
    }
  }

  return { bucketStart, backfillHours };
}

async function handleRollup(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Invalid or missing cron secret." },
      { status: 401 },
    );
  }

  if (!isAssignmentMetricsRollupEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: "ROLLUP_DISABLED",
        message: "Assignment metrics rollup is disabled.",
      },
      { status: 503 },
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

  const { bucketStart, backfillHours } = await parseRequestOptions(request);

  try {
    if (backfillHours != null) {
      const backfill = await backfillAssignmentMetricsHourly(client, { hours: backfillHours });
      return NextResponse.json({
        ok: true,
        backfill: true,
        hoursRequested: backfill.hoursRequested,
        hoursProcessed: backfill.hoursProcessed,
        hoursFailed: backfill.hoursFailed,
        maxBackfillHours: ASSIGNMENT_METRICS_MAX_BACKFILL_HOURS,
      });
    }

    const result = await rollupAssignmentMetricsHourly(client, bucketStart);

    return NextResponse.json({
      ok: true,
      bucketStart: result.bucketStart,
      offersCreated: result.offersCreated,
      offersAccepted: result.offersAccepted,
      bookingsAssigned: result.bookingsAssigned,
      upserted: result.upserted,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Assignment metrics rollup failed.";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleRollup(request);
}

export async function POST(request: Request) {
  return handleRollup(request);
}
