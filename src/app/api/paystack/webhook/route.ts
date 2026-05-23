import { NextResponse } from "next/server";
import { handlePaystackWebhook } from "@/features/payments/server/handlePaystackWebhook";
import { PaystackConfigError } from "@/features/payments/server/paystackEnv";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  try {
    const result = await handlePaystackWebhook(rawBody, signature);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.code, message: result.message },
        { status: result.status },
      );
    }

    if (!result.handled) {
      return NextResponse.json({ ok: true, ignored: true, reason: result.reason });
    }

    return NextResponse.json({
      ok: true,
      bookingId: result.bookingId,
      invoiceNumber: result.invoiceNumber,
      source: result.source,
      status: result.status,
      idempotent: result.idempotent,
    });
  } catch (e) {
    if (e instanceof PaystackConfigError) {
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
