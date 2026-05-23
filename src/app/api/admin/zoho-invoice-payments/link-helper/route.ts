import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { generateZohoInvoiceAdminPaymentLink } from "@/features/zoho-invoice-payments/server/generateZohoInvoiceAdminPaymentLink";

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

  const result = await generateZohoInvoiceAdminPaymentLink(invoiceNumber);
  if (!result.ok) {
    const status = result.code === "INVALID_INVOICE_NUMBER" ? 400 : 503;
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    invoiceNumber: result.invoiceNumber,
    normalizedInvoiceNumber: result.normalizedInvoiceNumber,
    paymentLink: result.paymentLink,
  });
}
