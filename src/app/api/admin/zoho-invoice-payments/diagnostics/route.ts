import { NextResponse } from "next/server";
import type { ZohoInvoicePaymentStatus } from "@/lib/database/types";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadZohoInvoicePaymentDiagnostics } from "@/features/zoho-invoice-payments/server/loadZohoInvoicePaymentDiagnostics";

const ALLOWED_STATUS_FILTERS = new Set<ZohoInvoicePaymentStatus>([
  "pending_paystack",
  "paid",
  "failed",
  "zoho_reconcile_pending",
  "zoho_reconcile_failed",
  "initialized",
  "cancelled",
]);

function parseLimit(value: string | null): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status")?.trim();
  const invoiceNumber = url.searchParams.get("invoiceNumber")?.trim() || undefined;
  const limit = parseLimit(url.searchParams.get("limit"));

  const status =
    statusParam && ALLOWED_STATUS_FILTERS.has(statusParam as ZohoInvoicePaymentStatus)
      ? (statusParam as ZohoInvoicePaymentStatus)
      : undefined;

  try {
    const diagnostics = await loadZohoInvoicePaymentDiagnostics({
      status,
      invoiceNumber,
      limit,
    });

    return NextResponse.json({ ok: true, ...diagnostics });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Could not load Zoho invoice payment diagnostics.",
      },
      { status: 500 },
    );
  }
}
