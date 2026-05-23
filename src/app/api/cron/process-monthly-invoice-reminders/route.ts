import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/verifyCronSecret";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isZohoMonthlyInvoiceAutomationEnabled } from "@/lib/app/zohoMonthlyInvoiceAutomationFlag";
import { processMonthlyInvoiceRemindersForCron } from "@/features/monthly-billing/server/processMonthlyInvoiceRemindersForCron";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 100;

async function handleReminders(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Invalid or missing cron secret." },
      { status: 401 },
    );
  }

  if (!isZohoMonthlyInvoiceAutomationEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "FEATURE_DISABLED",
      scanned: 0,
      remindersSent: 0,
      escalations: 0,
      skippedCount: 0,
      failed: 0,
    });
  }

  const client = createServiceRoleClient();
  if (!client) {
    return NextResponse.json(
      { ok: false, error: "AUTH_NOT_CONFIGURED", message: "Service role client not configured." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam
    ? Math.min(Math.max(Number(limitParam) || DEFAULT_LIMIT, 1), 200)
    : DEFAULT_LIMIT;

  try {
    const summary = await processMonthlyInvoiceRemindersForCron(limit, client);
    return NextResponse.json({ ok: true, ...summary });
  } catch {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "Monthly invoice reminder processing failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleReminders(request);
}

export async function POST(request: Request) {
  return handleReminders(request);
}
