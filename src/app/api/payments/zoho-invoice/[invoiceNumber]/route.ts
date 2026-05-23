import { NextResponse } from "next/server";
import { fetchZohoInvoicePaymentDetails } from "@/features/zoho-invoice-payments/server/fetchZohoInvoicePaymentDetails";

type RouteContext = {
  params: Promise<{ invoiceNumber: string }>;
};

function httpStatusForFailure(
  status: "not_configured" | "not_found" | "error",
): number {
  switch (status) {
    case "not_configured":
      return 503;
    case "not_found":
      return 404;
    case "error":
      return 502;
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { invoiceNumber } = await context.params;
  const result = await fetchZohoInvoicePaymentDetails(invoiceNumber);

  if (!result.ok) {
    if ("code" in result && result.code === "INVALID_INVOICE_NUMBER") {
      return NextResponse.json(
        { ok: false, error: result.code, message: result.message },
        { status: 400 },
      );
    }

    if ("status" in result) {
      return NextResponse.json(
        {
          ok: false,
          status: result.status,
          message: result.message,
        },
        { status: httpStatusForFailure(result.status) },
      );
    }

    return NextResponse.json(
      { ok: false, message: result.message },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, invoice: result.invoice });
}
