import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadMonthlyGovernanceDashboard } from "@/features/monthly-billing/server/loadMonthlyGovernanceDashboard";
import {
  buildMonthlyGovernanceCsv,
  buildMonthlyGovernanceJson,
} from "@/features/monthly-billing/server/exportMonthlyGovernanceCsv";

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
  const customerIdsParam = url.searchParams.get("customerIds");
  const customerIds = customerIdsParam
    ? customerIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
    : undefined;

  try {
    const dashboard = await loadMonthlyGovernanceDashboard();

    if (exportType === "csv") {
      return new NextResponse(buildMonthlyGovernanceCsv(dashboard, customerIds), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="monthly-governance-export.csv"',
        },
      });
    }

    if (exportType === "json") {
      return new NextResponse(buildMonthlyGovernanceJson(dashboard, customerIds), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": 'attachment; filename="monthly-governance-export.json"',
        },
      });
    }

    return NextResponse.json({ ok: true, dashboard });
  } catch {
    return NextResponse.json(
      { ok: false, error: "LOAD_FAILED", message: "Could not load governance dashboard." },
      { status: 500 },
    );
  }
}
