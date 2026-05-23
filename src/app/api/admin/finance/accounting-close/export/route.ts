import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  accountingCloseItemsToCsv,
  buildAccountingCloseDetailExportFilename,
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
      return NextResponse.json({ ok: true, summary: result.summary, items: result.items });
    }

    const csv = accountingCloseItemsToCsv(result.items, result.summary);
    const filename = buildAccountingCloseDetailExportFilename();

    logAccountingCloseEvent("accounting_close_exported", {
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
    logAccountingCloseEvent("accounting_close_failed", { stage: "export" });
    return NextResponse.json(
      {
        ok: false,
        error: "EXPORT_FAILED",
        message: "Could not export accounting close detail.",
      },
      { status: 500 },
    );
  }
}
