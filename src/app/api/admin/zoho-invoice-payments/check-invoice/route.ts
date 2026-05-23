import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { checkZohoInvoiceForAdmin } from "@/features/zoho-invoice-payments/server/checkZohoInvoiceForAdmin";

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

  const result = await checkZohoInvoiceForAdmin(invoiceNumber);
  if (!result.ok) {
    const status =
      result.code === "INVALID_INVOICE_NUMBER"
        ? 400
        : result.code === "NOT_FOUND"
          ? 404
          : result.code === "NOT_CONFIGURED"
            ? 503
            : 502;
    return NextResponse.json(
      {
        ok: false,
        error: result.code,
        message: result.message,
        invoiceNumber: result.invoiceNumber,
      },
      { status },
    );
  }

      return NextResponse.json(result);
}
