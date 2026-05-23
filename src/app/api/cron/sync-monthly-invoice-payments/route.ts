import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/verifyCronSecret";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isZohoMonthlyInvoicePaymentSyncEnabled } from "@/lib/app/zohoMonthlyInvoicePaymentSyncFlag";
import { syncMonthlyInvoicePaymentsForCron } from "@/features/monthly-billing/server/syncZohoMonthlyInvoicePaymentStatus";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 50;

async function handleSync(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Invalid or missing cron secret." },
      { status: 401 },
    );
  }

  if (!isZohoMonthlyInvoicePaymentSyncEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "FEATURE_DISABLED",
      checked: 0,
      paid: 0,
      overdue: 0,
      void: 0,
      failed: 0,
      unchanged: 0,
    });
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

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam
    ? Math.min(Math.max(Number(limitParam) || DEFAULT_LIMIT, 1), 200)
    : DEFAULT_LIMIT;

  try {
    const summary = await syncMonthlyInvoicePaymentsForCron(limit, client);
    return NextResponse.json({ ok: true, ...summary });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Monthly invoice payment sync failed.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}
