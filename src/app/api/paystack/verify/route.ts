import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { verifyPayment } from "@/features/payments/server/verifyPayment";
import { PaystackApiError } from "@/features/payments/server/paystackClient";
import { PaystackConfigError } from "@/features/payments/server/paystackEnv";

async function resolveReference(request: Request): Promise<string | null> {
  const url = new URL(request.url);
  const queryRef = url.searchParams.get("reference");
  if (queryRef?.trim()) return queryRef.trim();

  if (request.method === "POST") {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      if (typeof body.reference === "string" && body.reference.trim()) {
        return body.reference.trim();
      }
    } catch {
      return null;
    }
  }

  return null;
}

export async function GET(request: Request) {
  return handleVerify(request);
}

export async function POST(request: Request) {
  return handleVerify(request);
}

async function handleVerify(request: Request) {
  const reference = await resolveReference(request);
  if (!reference) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "reference is required." },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await verifyPayment(user, reference);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.code, message: result.message },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      reference: result.reference,
      bookingId: result.bookingId,
      status: result.status,
      paid: result.paid,
      idempotent: result.idempotent,
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
      { ok: false, error: "INTERNAL_ERROR", message: "Verify failed." },
      { status: 500 },
    );
  }
}
