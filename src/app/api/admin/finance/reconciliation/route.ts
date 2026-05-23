import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadFinanceReconciliation } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import { parseFinanceReconciliationQueryParams } from "@/features/finance-reconciliation/server/parseFinanceReconciliationQueryParams";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const filters = parseFinanceReconciliationQueryParams(new URL(request.url).searchParams);

  try {
    const result = await loadFinanceReconciliation(filters);
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Could not load finance reconciliation data.",
      },
      { status: 500 },
    );
  }
}
