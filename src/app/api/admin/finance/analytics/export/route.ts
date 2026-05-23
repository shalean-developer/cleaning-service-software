import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  buildFinanceAnalyticsExportFilename,
  financeAnalyticsSectionToCsv,
  type FinanceAnalyticsExportSection,
} from "@/features/finance-analytics/server/financeAnalyticsExport";
import { logFinanceAnalyticsEvent } from "@/features/finance-analytics/server/financeAnalyticsLogger";
import { loadFinanceAnalyticsForExport } from "@/features/finance-analytics/server/financeAnalyticsReadModel";
import { parseFinanceAnalyticsQueryParams } from "@/features/finance-analytics/server/parseFinanceAnalyticsQueryParams";

const ALLOWED_SECTIONS = new Set<FinanceAnalyticsExportSection>([
  "summary",
  "revenue-trends",
  "profitability",
  "operational",
]);

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format")?.trim().toLowerCase() ?? "csv";
  const sectionParam = url.searchParams.get("section")?.trim() as
    | FinanceAnalyticsExportSection
    | undefined;
  const section =
    sectionParam && ALLOWED_SECTIONS.has(sectionParam) ? sectionParam : "summary";
  const filters = parseFinanceAnalyticsQueryParams(url.searchParams);

  try {
    const result = await loadFinanceAnalyticsForExport(filters);

    if (format === "json") {
      return NextResponse.json({ ok: true, section, ...result });
    }

    const csv = financeAnalyticsSectionToCsv(result, section, filters.from, filters.to);
    const filename = buildFinanceAnalyticsExportFilename(section);

    logFinanceAnalyticsEvent("finance_analytics_exported", {
      exportSection: section,
      rowCount:
        section === "revenue-trends"
          ? result.revenueTrends.length
          : section === "profitability"
            ? result.profitability.revenueByServiceType.length
            : 1,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    logFinanceAnalyticsEvent("finance_analytics_failed", { stage: "export" });
    return NextResponse.json(
      {
        ok: false,
        error: "EXPORT_FAILED",
        message: "Could not export finance analytics.",
      },
      { status: 500 },
    );
  }
}
