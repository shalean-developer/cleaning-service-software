import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron/verifyCronSecret";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { retryZohoInvoiceReconciliation } from "@/features/zoho-invoice-payments/server/retryZohoInvoiceReconciliation";
import { retryZohoInvoiceAuthorizationChargeReconciliation } from "@/features/zoho-invoice-payments/server/retryZohoInvoiceAuthorizationChargeReconciliation";
import {
  completeZohoInvoicePaymentCronRun,
  failZohoInvoicePaymentCronRun,
  startZohoInvoicePaymentCronRun,
} from "@/features/zoho-invoice-payments/server/zohoInvoicePaymentCronRunRepository";

export const runtime = "nodejs";

const JOB_NAME = "reconcile-zoho-invoice-payments";

async function handleReconcile(request: Request) {
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

  let cronRunId: string | null = null;

  try {
    const cronRun = await startZohoInvoicePaymentCronRun({ jobName: JOB_NAME }, client);
    cronRunId = cronRun.id;

    const summary = await retryZohoInvoiceReconciliation({}, client);
    const authChargeSummary = await retryZohoInvoiceAuthorizationChargeReconciliation({}, client);
    const responseBody = {
      ok: true as const,
      ...summary,
      authorizationCharges: authChargeSummary,
    };

    await completeZohoInvoicePaymentCronRun(cronRunId, responseBody, client);

    return NextResponse.json(responseBody);
  } catch {
    if (cronRunId) {
      await failZohoInvoicePaymentCronRun(
        cronRunId,
        { ok: false, error: "INTERNAL_ERROR" },
        client,
      ).catch(() => undefined);
    }

    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Zoho invoice reconciliation retry failed.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleReconcile(request);
}

export async function POST(request: Request) {
  return handleReconcile(request);
}
