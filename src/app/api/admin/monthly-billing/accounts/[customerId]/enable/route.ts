import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { enableCustomerMonthlyBillingAccount } from "@/features/monthly-billing/server/enableCustomerMonthlyBillingAccountFacade";
import { parseEnableMonthlyBillingBody } from "@/features/monthly-billing/server/parseMonthlyBillingMutationBody";
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

  const parsed = parseEnableMonthlyBillingBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.code, message: parsed.message },
      { status: 400 },
    );
  }

  const result = await enableCustomerMonthlyBillingAccount({
    admin: user,
    customerId,
    billingEmail: parsed.values.billingEmail,
    billingTerms: parsed.values.billingTerms,
    approvalReason: parsed.values.approvalReason,
    idempotencyKey: parsed.values.idempotencyKey,
    zohoCustomerId: parsed.values.zohoCustomerId,
    createZohoCustomer: parsed.values.createZohoCustomer,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, account: result.account, idempotent: result.idempotent });
}
