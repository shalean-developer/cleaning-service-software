import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { revokeCustomerPaymentMethod } from "@/features/zoho-invoice-payments/server/revokeCustomerPaymentMethod";

type RouteContext = { params: Promise<{ paymentMethodId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["customer"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const customerEmail = user.authUser.email?.trim();
  if (!customerEmail) {
    return NextResponse.json(
      {
        ok: false,
        error: "MISSING_EMAIL",
        message: "Your account does not have an email address.",
      },
      { status: 400 },
    );
  }

  const { paymentMethodId } = await context.params;
  if (!paymentMethodId?.trim()) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ID", message: "Payment method id is required." },
      { status: 400 },
    );
  }

  let body: { reason?: string } = {};
  try {
    body = (await request.json()) as { reason?: string };
  } catch {
    body = {};
  }

  const result = await revokeCustomerPaymentMethod({
    paymentMethodId: paymentMethodId.trim(),
    customerEmail,
    actorProfileId: user.profileId,
    reason: body.reason,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    paymentMethodId: result.paymentMethodId,
    idempotent: result.idempotent,
  });
}
