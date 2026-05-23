import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/verifyCronSecret";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { retryZohoRefundCreditSync } from "@/features/zoho-sales-sync/server/retryZohoRefundCreditSync";

export const runtime = "nodejs";

const JOB_NAME = "sync-zoho-refunds-credits";

async function handleSync(request: Request) {
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
    const summary = await retryZohoRefundCreditSync({}, client);
    return NextResponse.json({ ok: true, jobName: JOB_NAME, ...summary });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Zoho refund/credit sync retry failed.",
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
