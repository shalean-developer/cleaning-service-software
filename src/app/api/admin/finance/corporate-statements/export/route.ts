import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  buildCorporateStatementExportFilename,
  corporateStatementItemsToCsv,
} from "@/features/corporate-statements/server/corporateStatementExport";
import { logCorporateStatementEvent } from "@/features/corporate-statements/server/corporateStatementLogger";
import { loadCorporateStatementForExport } from "@/features/corporate-statements/server/corporateStatementReadModel";
import {
  CorporateStatementValidationError,
  parseCorporateStatementQueryParams,
} from "@/features/corporate-statements/server/parseCorporateStatementQueryParams";

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

  try {
    const filters = parseCorporateStatementQueryParams(url.searchParams);
    const result = await loadCorporateStatementForExport(filters);

    if (format === "json") {
      return NextResponse.json({ ok: true, ...result });
    }

    const csv = corporateStatementItemsToCsv(result.items, result.summary);
    const filename = buildCorporateStatementExportFilename();

    logCorporateStatementEvent("corporate_statement_exported", {
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
  } catch (error) {
    logCorporateStatementEvent("corporate_statement_failed", { stage: "export" });
    if (error instanceof CorporateStatementValidationError) {
      return NextResponse.json(
        { ok: false, error: error.code, message: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: "EXPORT_FAILED",
        message: "Could not export corporate statement.",
      },
      { status: 500 },
    );
  }
}
