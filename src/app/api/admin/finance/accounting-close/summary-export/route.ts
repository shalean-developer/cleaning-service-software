import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  accountingCloseSummaryToCsv,
  buildAccountingCloseSummaryExportFilename,
} from "@/features/accounting-close/server/accountingCloseExport";
import { logAccountingCloseEvent } from "@/features/accounting-close/server/accountingCloseLogger";
import { loadAccountingCloseForExport } from "@/features/accounting-close/server/accountingCloseReadModel";
import { parseAccountingCloseQueryParams } from "@/features/accounting-close/server/parseAccountingCloseQueryParams";

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
  const filters = parseAccountingCloseQueryParams(url.searchParams);

  try {
    const result = await loadAccountingCloseForExport(filters);

    if (format === "json") {
      return NextResponse.json({ ok: true, summary: result.summary });
    }

    const csv = accountingCloseSummaryToCsv(result.summary);
    const filename = buildAccountingCloseSummaryExportFilename();

    logAccountingCloseEvent("accounting_close_exported", {
      exportType: "summary",
      readyToClose: result.summary.readyToClose,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    logAccountingCloseEvent("accounting_close_failed", { stage: "summary_export" });
    return NextResponse.json(
      {
        ok: false,
        error: "EXPORT_FAILED",
        message: "Could not export accounting close summary.",
      },
      { status: 500 },
    );
  }
}
