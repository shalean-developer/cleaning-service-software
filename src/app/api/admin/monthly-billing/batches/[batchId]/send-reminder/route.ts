import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { sendMonthlyInvoiceReminderForAdmin } from "@/features/monthly-billing/server/monthlyInvoiceOperationsForAdmin";
import { parseSendMonthlyInvoiceReminderBody } from "@/features/monthly-billing/server/parseMonthlyBillingMutationBody";
import { isUuid } from "@/lib/validation/uuid";

type RouteContext = { params: Promise<{ batchId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { batchId } = await context.params;
  if (!isUuid(batchId)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "batchId must be a valid UUID." },
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

  const parsed = parseSendMonthlyInvoiceReminderBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.code, message: parsed.message },
      { status: 400 },
    );
  }

  const result = await sendMonthlyInvoiceReminderForAdmin({
    admin: user,
    batchId,
    idempotencyKey: parsed.values.idempotencyKey,
    reason: parsed.values.reason,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    reminder: result.reminder,
  });
}
