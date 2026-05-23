import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { executeMonthlyGovernanceBulkAction } from "@/features/monthly-billing/server/executeMonthlyGovernanceBulkAction";
import { parseMonthlyGovernanceBulkActionBody } from "@/features/monthly-billing/server/parseMonthlyBillingMutationBody";

export async function POST(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
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

  const parsed = parseMonthlyGovernanceBulkActionBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.code, message: parsed.message },
      { status: 400 },
    );
  }

  const result = await executeMonthlyGovernanceBulkAction({
    admin: user,
    action: parsed.values.action,
    customerIds: parsed.values.customerIds,
    reason: parsed.values.reason,
    idempotencyKey: parsed.values.idempotencyKey,
    confirmAction: true,
    reviewOwnerAdminId: parsed.values.reviewOwnerAdminId,
    followUpDate: parsed.values.followUpDate,
    noteContent: parsed.values.noteContent,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, result });
}
