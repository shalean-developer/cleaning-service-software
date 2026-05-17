import { NextResponse } from "next/server";
import { processNotificationOutbox } from "@/features/notifications/server/processNotificationOutbox";
import { verifyCronSecret } from "@/lib/cron/verifyCronSecret";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

export const runtime = "nodejs";

/**
 * Notification outbox delivery (Stage 5C-1a: payment_confirmed email only).
 * GET/POST with Authorization: Bearer $CRON_SECRET or x-cron-secret header.
 * See docs/operations/notification-outbox-worker.md
 */
async function handleProcess(request: Request) {
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
    const result = await processNotificationOutbox(client);

    return NextResponse.json({
      ok: true,
      deliveryEnabled: result.deliveryEnabled,
      emailProvider: result.emailProvider,
      reclaimed: result.reclaimed,
      scanned: result.scanned,
      sent: result.sent,
      skipped: result.skipped,
      dryRun: result.dryRun,
      failed: result.failed,
      errors: result.errors,
      dryRunPreviews: result.dryRunPreviews,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Notification outbox processing failed.";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleProcess(request);
}

export async function POST(request: Request) {
  return handleProcess(request);
}
