import { NextResponse } from "next/server";
import { initializeZohoInvoicePayment } from "@/features/zoho-invoice-payments/server/initializeZohoInvoicePayment";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const record = body as Record<string, unknown>;
  const invoiceNumber =
    typeof record.invoiceNumber === "string" ? record.invoiceNumber.trim() : "";
  const savePaymentMethodConsent = record.savePaymentMethodConsent === true;

  if (!invoiceNumber) {
    return NextResponse.json(
      { ok: false, message: "invoiceNumber is required." },
      { status: 400 },
    );
  }

  const result = await initializeZohoInvoicePayment(invoiceNumber, {
    savePaymentMethodConsent,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    authorizationUrl: result.authorizationUrl,
    reference: result.reference,
    invoiceNumber: result.invoiceNumber,
    amountCents: result.amountCents,
    currency: result.currency,
  });
}
