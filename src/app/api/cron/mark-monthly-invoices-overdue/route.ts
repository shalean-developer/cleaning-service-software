import { NextResponse } from "next/server";
import { markMonthlyInvoicesOverdueForCron } from "@/features/monthly-billing/server/markMonthlyInvoiceOverdue";
import { verifyCronSecret } from "@/lib/cron/verifyCronSecret";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { isZohoMonthlyInvoiceOperationsEnabled } from "@/lib/app/zohoMonthlyInvoiceOperationsFlag";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 100;

async function handleMarkOverdue(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Invalid or missing cron secret." },
      { status: 401 },
    );
  }

  if (!isZohoMonthlyInvoiceOperationsEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "FEATURE_DISABLED",
      checked: 0,
      marked: 0,
      skippedCount: 0,
      failed: 0,
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
    const summary = await markMonthlyInvoicesOverdueForCron(limit, client);
    return NextResponse.json({ ok: true, ...summary });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Monthly invoice overdue marking failed.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleMarkOverdue(request);
}

export async function POST(request: Request) {
  return handleMarkOverdue(request);
}
