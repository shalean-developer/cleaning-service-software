import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { updateMonthlyAccountGovernanceState } from "@/features/monthly-billing/server/monthlyAccountGovernanceFacade";
import { parseUpdateMonthlyAccountGovernanceStateBody } from "@/features/monthly-billing/server/parseMonthlyBillingMutationBody";
import { isUuid } from "@/lib/validation/uuid";

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
  if (!isUuid(customerId)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "customerId must be a valid UUID." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = parseUpdateMonthlyAccountGovernanceStateBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.code, message: parsed.message },
      { status: 400 },
    );
  }

  const result = await updateMonthlyAccountGovernanceState({
    admin: user,
    customerId,
    governanceState: parsed.values.governanceState,
    reason: parsed.values.reason,
    idempotencyKey: parsed.values.idempotencyKey,
    confirmAction: parsed.values.confirmAction,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, account: result.account, idempotent: result.idempotent });
}
