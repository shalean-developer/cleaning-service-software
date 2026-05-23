import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  adminAssistedWeeklyProductionToCsv,
  adminAssistedWeeklyProductionToJson,
  buildAdminAssistedWeeklyExportFilename,
} from "@/features/bookings/server/admin/adminAssistedWeeklyProductionExport";
import { loadAdminAssistedProductionStatus } from "@/features/bookings/server/admin/loadAdminAssistedProductionStatus";

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
    const status = await loadAdminAssistedProductionStatus();

    if (format === "json") {
      return NextResponse.json(adminAssistedWeeklyProductionToJson(status));
    }

    const csv = adminAssistedWeeklyProductionToCsv(status);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildAdminAssistedWeeklyExportFilename()}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not export weekly report.";
    return NextResponse.json({ ok: false, error: "EXPORT_FAILED", message }, { status: 500 });
  }
}
