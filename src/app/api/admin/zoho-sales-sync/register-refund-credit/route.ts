import { NextResponse } from "next/server";
import type { ZohoRefundCreditSyncSourceType } from "@/lib/database/types";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { registerZohoRefundCredit } from "@/features/zoho-sales-sync/server/registerZohoRefundCredit";

const ALLOWED_SOURCE_TYPES = new Set<ZohoRefundCreditSyncSourceType>([
  "booking_refund",
  "booking_cancellation",
  "zoho_invoice_refund",
  "zoho_authorization_charge_refund",
]);

type RegisterRefundCreditBody = {
  sourceType?: string;
  sourceId?: string;
  amountCents?: number;
  reason?: string;
  confirmPhrase?: string;
  bookingId?: string;
  invoiceNumber?: string;
  zohoInvoiceId?: string;
  paystackReference?: string;
};

export async function POST(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  let body: RegisterRefundCreditBody;
  try {
    body = (await request.json()) as RegisterRefundCreditBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const sourceType = body.sourceType?.trim() as ZohoRefundCreditSyncSourceType | undefined;
  const sourceId = body.sourceId?.trim();

  if (!sourceType || !ALLOWED_SOURCE_TYPES.has(sourceType)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_SOURCE_TYPE", message: "Invalid source type." },
      { status: 400 },
    );
  }

  if (!sourceId) {
    return NextResponse.json(
      { ok: false, error: "SOURCE_ID_REQUIRED", message: "Source ID is required." },
      { status: 400 },
    );
  }

  const result = await registerZohoRefundCredit({
    sourceType,
    sourceId,
    amountCents: body.amountCents ?? 0,
    reason: body.reason ?? "",
    confirmPhrase: body.confirmPhrase ?? "",
    bookingId: body.bookingId?.trim() || null,
    invoiceNumber: body.invoiceNumber?.trim() || null,
    zohoInvoiceId: body.zohoInvoiceId?.trim() || null,
    paystackReference: body.paystackReference?.trim() || null,
    initiatedByAdminId: user.id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    syncId: result.syncId,
    enqueued: result.enqueued,
    message: "Credit sync registered. Zoho credit note will be created asynchronously.",
  });
}
