import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { parseUpdateMonthlyAccountFinanceReviewBody } from "@/features/monthly-billing/server/parseMonthlyBillingMutationBody";
import { updateMonthlyAccountFinanceReview } from "@/features/monthly-billing/server/updateMonthlyAccountFinanceReview";

type RouteContext = { params: Promise<{ customerId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { customerId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = parseUpdateMonthlyAccountFinanceReviewBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.code, message: parsed.message },
      { status: 400 },
    );
  }

  const result = await updateMonthlyAccountFinanceReview({
    admin: user,
    customerId,
    reason: parsed.values.reason,
    idempotencyKey: parsed.values.idempotencyKey,
    confirmAction: true,
    reviewOwnerAdminId: parsed.values.reviewOwnerAdminId,
    followUpDate: parsed.values.followUpDate,
    reviewStatus: parsed.values.reviewStatus,
    resolution: parsed.values.resolution,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    account: result.account,
    idempotent: result.idempotent,
  });
}
