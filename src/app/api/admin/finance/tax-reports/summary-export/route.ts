import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  buildTaxReportSummaryExportFilename,
  taxReportSummaryToCsv,
} from "@/features/tax-reports/server/taxReportExport";
import { logTaxReportEvent } from "@/features/tax-reports/server/taxReportLogger";
import { loadTaxReportForExport } from "@/features/tax-reports/server/taxReportReadModel";
import { parseTaxReportQueryParams } from "@/features/tax-reports/server/parseTaxReportQueryParams";

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
  const filters = parseTaxReportQueryParams(url.searchParams);

  try {
    const result = await loadTaxReportForExport(filters);

    if (format === "json") {
      return NextResponse.json({ ok: true, summary: result.summary });
    }

    const csv = taxReportSummaryToCsv(result.summary);
    const filename = buildTaxReportSummaryExportFilename();

    logTaxReportEvent("tax_report_exported", {
      exportType: "summary",
      vatRegistered: result.summary.vatRegistered,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    logTaxReportEvent("tax_report_failed", { stage: "summary_export" });
    return NextResponse.json(
      {
        ok: false,
        error: "EXPORT_FAILED",
        message: "Could not export tax report summary.",
      },
      { status: 500 },
    );
  }
}
