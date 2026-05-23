import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadFinanceAnalytics } from "@/features/finance-analytics/server/financeAnalyticsReadModel";
import { parseFinanceAnalyticsQueryParams } from "@/features/finance-analytics/server/parseFinanceAnalyticsQueryParams";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const filters = parseFinanceAnalyticsQueryParams(new URL(request.url).searchParams);

  try {
    const result = await loadFinanceAnalytics(filters);
    return NextResponse.json({
      ok: true,
      executiveSummary: result.executiveSummary,
      revenueTrends: result.revenueTrends,
      profitability: result.profitability,
      customerInsights: result.customerInsights,
      operationalHealth: result.operationalHealth,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Could not load finance analytics.",
      },
      { status: 500 },
    );
  }
}
