import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createPaymentRetryLock } from "@/features/bookings/server/lock/createPaymentRetryLock";

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { bookingId } = await context.params;
  const trimmedBookingId = bookingId?.trim();
  if (!trimmedBookingId) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "bookingId is required." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (body == null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Body must be a JSON object." },
      { status: 400 },
    );
  }

  const payload = body as Record<string, unknown>;
  const checkoutIdempotencyKey =
    typeof payload.checkoutIdempotencyKey === "string"
      ? payload.checkoutIdempotencyKey.trim()
      : typeof payload.checkout_idempotency_key === "string"
        ? payload.checkout_idempotency_key.trim()
        : "";

  const result = await createPaymentRetryLock(user, trimmedBookingId, {
    checkoutIdempotencyKey,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    lockId: result.lockId,
    bookingId: result.bookingId,
    lockedPriceCents: result.lockedPriceCents,
    currency: result.currency,
    expiresAt: result.expiresAt,
    paymentIdempotencyKey: result.paymentIdempotencyKey,
    idempotent: result.idempotent,
  });
}
