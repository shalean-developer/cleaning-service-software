import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  loadCustomerBillingAccountList,
  loadMonthlyBillingAccountsOverview,
} from "@/features/monthly-billing/server/customerBillingAccountReadModel";
import {
  MonthlyBillingValidationError,
  parseMonthlyBillingAccountsQuery,
} from "@/features/monthly-billing/server/parseMonthlyBillingQueryParams";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  try {
    const filters = parseMonthlyBillingAccountsQuery(new URL(request.url).searchParams);
    const [overview, accounts] = await Promise.all([
      loadMonthlyBillingAccountsOverview(),
      loadCustomerBillingAccountList({
        status: filters.status,
        mode: filters.mode,
        limit: filters.limit,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      readOnly: true,
      phase: 1,
      overview,
      accounts,
    });
  } catch (error) {
    if (error instanceof MonthlyBillingValidationError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "Could not load billing accounts." },
      { status: 500 },
    );
  }
}
