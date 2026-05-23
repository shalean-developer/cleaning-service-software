import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadMonthlyCollectionsDashboard } from "@/features/monthly-billing/server/loadMonthlyCollectionsDashboard";
import {
  buildAgingReportCsv,
  buildCollectionsSummaryCsv,
  buildOverdueAccountsCsv,
} from "@/features/monthly-billing/server/exportMonthlyCollectionsCsv";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const url = new URL(request.url);
  const exportType = url.searchParams.get("export");

  try {
    const dashboard = await loadMonthlyCollectionsDashboard();
    if (exportType === "summary") {
      return new NextResponse(buildCollectionsSummaryCsv(dashboard), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="collections-summary.csv"',
        },
      });
    }
    if (exportType === "overdue") {
      return new NextResponse(buildOverdueAccountsCsv(dashboard), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="overdue-accounts.csv"',
        },
      });
    }
    if (exportType === "aging") {
      return new NextResponse(buildAgingReportCsv(dashboard), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="aging-report.csv"',
        },
      });
    }

    return NextResponse.json({ ok: true, dashboard });
  } catch {
    return NextResponse.json(
      { ok: false, error: "LOAD_FAILED", message: "Could not load collections dashboard." },
      { status: 500 },
    );
  }
}
