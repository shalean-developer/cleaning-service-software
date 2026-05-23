import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  adminAssistedPilotPanelToCsv,
  adminAssistedPilotPanelToJson,
  buildAdminAssistedPilotExportFilename,
} from "@/features/bookings/server/admin/adminAssistedPilotExport";
import { loadAdminAssistedPilotQaPanel } from "@/features/bookings/server/admin/loadAdminAssistedPilotQaPanel";

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
    const panel = await loadAdminAssistedPilotQaPanel();

    if (format === "json") {
      return NextResponse.json(adminAssistedPilotPanelToJson(panel));
    }

    const csv = adminAssistedPilotPanelToCsv(panel);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${buildAdminAssistedPilotExportFilename()}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not export pilot data.";
    return NextResponse.json({ ok: false, error: "EXPORT_FAILED", message }, { status: 500 });
  }
}
