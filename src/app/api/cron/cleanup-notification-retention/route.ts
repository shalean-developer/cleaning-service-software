import { NextResponse } from "next/server";
import { reportNotificationRetentionDryRun } from "@/features/notifications/server/reportNotificationRetentionDryRun";
import { verifyCronSecret } from "@/lib/cron/verifyCronSecret";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";

/**
 * Stage 5I-α: retention eligibility dry-run only (counts, no DELETE/UPDATE).
 * See docs/operations/notification-outbox-worker.md
 */
async function handleCleanupRetention(request: Request) {
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
    const report = await reportNotificationRetentionDryRun(client);

    console.warn(
      JSON.stringify({
        event: "notification_retention_dry_run",
        at: report.asOf,
        dryRun: report.dryRun,
        deleted: report.deleted,
        policy: report.policy,
        eligible: report.eligible,
        protected: report.protected,
      }),
    );

    return NextResponse.json({
      ok: true,
      ...report,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Notification retention dry-run failed.";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message, dryRun: true, deleted: 0 },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleCleanupRetention(request);
}

export async function POST(request: Request) {
  return handleCleanupRetention(request);
}
