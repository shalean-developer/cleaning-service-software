import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  buildFinanceReconciliationExportFilename,
  financeReconciliationItemsToCsv,
} from "@/features/finance-reconciliation/server/financeReconciliationExport";
import { logFinanceReconciliationEvent } from "@/features/finance-reconciliation/server/financeReconciliationLogger";
import { loadFinanceReconciliationForExport } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import { parseFinanceReconciliationQueryParams } from "@/features/finance-reconciliation/server/parseFinanceReconciliationQueryParams";

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
  const filters = parseFinanceReconciliationQueryParams(url.searchParams);

  try {
    const items = await loadFinanceReconciliationForExport(filters);

    if (format === "json") {
      return NextResponse.json({ ok: true, items });
    }

    const csv = financeReconciliationItemsToCsv(items);
    const filename = buildFinanceReconciliationExportFilename();

    logFinanceReconciliationEvent("finance_reconciliation_exported", {
      rowCount: items.length,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Export-Returned-Count": String(items.length),
      },
    });
  } catch {
    logFinanceReconciliationEvent("finance_reconciliation_failed", { stage: "export" });
    return NextResponse.json(
      {
        ok: false,
        error: "EXPORT_FAILED",
        message: "Could not export finance reconciliation data.",
      },
      { status: 500 },
    );
  }
}
