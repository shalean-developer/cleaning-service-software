import { NextResponse } from "next/server";
import { fetchZohoInvoicePaymentStatusByReference } from "@/features/zoho-invoice-payments/server/fetchZohoInvoicePaymentStatusByReference";

type RouteContext = {
  params: Promise<{ reference: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { reference } = await context.params;
  const result = await fetchZohoInvoicePaymentStatusByReference(reference);

  if (!result.ok) {
    const status = result.code === "INVALID_REFERENCE" ? 400 : 404;
    return NextResponse.json(
      { ok: false, code: result.code, message: result.message },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    invoiceNumber: result.invoiceNumber,
    reference: result.reference,
    status: result.status,
    message: result.message,
  });
}
