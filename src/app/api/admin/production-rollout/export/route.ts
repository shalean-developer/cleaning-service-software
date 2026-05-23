import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  buildProductionRolloutExportFilename,
  productionRolloutSummaryToCsv,
} from "@/features/production-rollout/server/productionRolloutExport";
import { logProductionRolloutEvent } from "@/features/production-rollout/server/productionRolloutLogger";
import { loadProductionRolloutForExport } from "@/features/production-rollout/server/productionRolloutReadModel";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const format = new URL(request.url).searchParams.get("format")?.trim().toLowerCase() ?? "csv";

  try {
    const status = await loadProductionRolloutForExport();

    if (format === "json") {
      return NextResponse.json({ ok: true, ...status });
    }

    const csv = productionRolloutSummaryToCsv({
      status,
      featureFlagRecommendations: status.featureFlagRecommendations,
    });
    const filename = buildProductionRolloutExportFilename();

    logProductionRolloutEvent("production_rollout_exported", {
      checklistCount: status.checklist.length,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    logProductionRolloutEvent("production_rollout_failed", { stage: "export" });
    return NextResponse.json(
      {
        ok: false,
        error: "EXPORT_FAILED",
        message: "Could not export production rollout report.",
      },
      { status: 500 },
    );
  }
}
