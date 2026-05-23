import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadCustomerBillingAccountReadModel } from "@/features/monthly-billing/server/customerBillingAccountReadModel";
import {
  MonthlyBillingValidationError,
  assertCustomerIdParam,
} from "@/features/monthly-billing/server/parseMonthlyBillingQueryParams";

type RouteContext = { params: Promise<{ customerId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  try {
    const { customerId } = await context.params;
    assertCustomerIdParam(customerId);

    const account = await loadCustomerBillingAccountReadModel(customerId);

    return NextResponse.json({
      ok: true,
      readOnly: true,
      phase: 1,
      account,
    });
  } catch (error) {
    if (error instanceof MonthlyBillingValidationError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "Could not load billing account." },
      { status: 500 },
    );
  }
}
