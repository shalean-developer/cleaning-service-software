import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadMonthlyBillingAccountsOverview } from "@/features/monthly-billing/server/customerBillingAccountReadModel";
import { loadMonthlyInvoiceBatchList } from "@/features/monthly-billing/server/monthlyInvoiceBatchReadModel";
import {
  MonthlyBillingValidationError,
  parseMonthlyBillingBatchesQuery,
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
    const filters = parseMonthlyBillingBatchesQuery(new URL(request.url).searchParams);
    const [overview, batches] = await Promise.all([
      loadMonthlyBillingAccountsOverview(),
      loadMonthlyInvoiceBatchList({
        customerId: filters.customerId,
        status: filters.status,
        billingMonth: filters.billingMonth,
        limit: filters.limit,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      readOnly: true,
      phase: 1,
      overview,
      batches,
    });
  } catch (error) {
    if (error instanceof MonthlyBillingValidationError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: "Could not load invoice batches." },
      { status: 500 },
    );
  }
}
