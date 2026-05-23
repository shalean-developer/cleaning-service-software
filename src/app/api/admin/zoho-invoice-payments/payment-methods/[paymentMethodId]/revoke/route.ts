import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { revokeAdminPaymentMethod } from "@/features/zoho-invoice-payments/server/revokeAdminPaymentMethod";

type RouteContext = { params: Promise<{ paymentMethodId: string }> };

type RevokeBody = {
  reason?: string;
  confirmPhrase?: string;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { paymentMethodId } = await context.params;
  if (!paymentMethodId?.trim()) {
    return NextResponse.json(
      { ok: false, error: "INVALID_ID", message: "Payment method id is required." },
      { status: 400 },
    );
  }

  let body: RevokeBody;
  try {
    body = (await request.json()) as RevokeBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const result = await revokeAdminPaymentMethod({
    paymentMethodId: paymentMethodId.trim(),
    adminProfileId: user.profileId,
    reason: body.reason ?? "",
    confirmPhrase: body.confirmPhrase ?? "",
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
