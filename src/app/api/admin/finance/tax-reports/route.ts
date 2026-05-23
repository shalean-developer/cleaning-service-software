import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadTaxReport } from "@/features/tax-reports/server/taxReportReadModel";
import { parseTaxReportQueryParams } from "@/features/tax-reports/server/parseTaxReportQueryParams";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const filters = parseTaxReportQueryParams(new URL(request.url).searchParams);

  try {
    const result = await loadTaxReport(filters);
    return NextResponse.json({
      ok: true,
      summary: result.summary,
      items: result.items,
      sourceBreakdown: result.sourceBreakdown,
      includesUnresolved: result.includesUnresolved,
      hasUnresolvedWarning: result.hasUnresolvedWarning,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Could not load tax report data.",
      },
      { status: 500 },
    );
  }
}
