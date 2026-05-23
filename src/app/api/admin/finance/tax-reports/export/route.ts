import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  buildTaxReportDetailExportFilename,
  taxReportItemsToCsv,
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
      return NextResponse.json({ ok: true, ...result });
    }

    const csv = taxReportItemsToCsv(result.items, result.summary);
    const filename = buildTaxReportDetailExportFilename();

    logTaxReportEvent("tax_report_exported", {
      exportType: "detail",
      rowCount: result.items.length,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Returned-Count": String(result.items.length),
      },
    });
  } catch {
    logTaxReportEvent("tax_report_failed", { stage: "export" });
    return NextResponse.json(
      {
        ok: false,
        error: "EXPORT_FAILED",
        message: "Could not export tax report detail.",
      },
      { status: 500 },
    );
  }
}
