import { NextResponse } from "next/server";
import { getServerPaystackPaymentSuccessCallbackUrl } from "@/lib/app/appBaseUrl";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { initializePayment } from "@/features/payments/server/initializePayment";
import { PaystackApiError } from "@/features/payments/server/paystackClient";
import { PaystackConfigError } from "@/features/payments/server/paystackEnv";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "email is required." },
      { status: 400 },
    );
  }

  try {
    const bookingId = typeof payload.bookingId === "string" ? payload.bookingId.trim() : "";
    if (!bookingId) {
      return NextResponse.json(
        { ok: false, error: "INVALID_PAYLOAD", message: "bookingId is required." },
        { status: 400 },
      );
    }

    const result = await initializePayment(user, {
      bookingId,
      lockId: typeof payload.lockId === "string" ? payload.lockId : undefined,
      priceCents:
        typeof payload.priceCents === "number" ? payload.priceCents : undefined,
      paymentIdempotencyKey:
        typeof payload.paymentIdempotencyKey === "string"
          ? payload.paymentIdempotencyKey
          : undefined,
      email,
      callbackUrl: resolveInitializeCallbackUrl(payload.callbackUrl),
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.code, message: result.message },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      bookingId: result.bookingId,
      paymentId: result.paymentId,
      status: result.status,
      authorization_url: result.authorizationUrl,
      access_code: result.accessCode,
      reference: result.reference,
    });
  } catch (e) {
    if (e instanceof PaystackConfigError) {
      return NextResponse.json(
        { ok: false, error: e.code, message: e.message },
        { status: 503 },
      );
    }
    if (e instanceof PaystackApiError) {
      return NextResponse.json(
        { ok: false, error: "PAYSTACK_API_ERROR", message: e.message },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "Initialize failed." },
      { status: 500 },
    );
  }
}

function resolveInitializeCallbackUrl(clientValue: unknown): string | undefined {
  if (typeof clientValue === "string" && clientValue.trim()) {
    return clientValue.trim();
  }
  return getServerPaystackPaymentSuccessCallbackUrl() ?? undefined;
}
