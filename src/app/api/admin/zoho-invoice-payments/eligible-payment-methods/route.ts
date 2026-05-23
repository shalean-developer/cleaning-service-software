import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadEligibleZohoInvoicePaymentMethodsForAdmin } from "@/features/zoho-invoice-payments/server/loadEligibleZohoInvoicePaymentMethodsForAdmin";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const invoiceNumber = new URL(request.url).searchParams.get("invoiceNumber")?.trim();
  if (!invoiceNumber) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_INVOICE_NUMBER",
        message: "Invoice number is required.",
      },
      { status: 400 },
    );
  }

  const result = await loadEligibleZohoInvoicePaymentMethodsForAdmin(invoiceNumber);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, ...result });
}
