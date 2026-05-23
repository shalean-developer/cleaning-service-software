import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadAdminAssistedPilotQaPanel } from "@/features/bookings/server/admin/loadAdminAssistedPilotQaPanel";

export async function GET() {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  try {
    const panel = await loadAdminAssistedPilotQaPanel();
    return NextResponse.json({ ok: true, panel });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load pilot QA panel.";
    return NextResponse.json({ ok: false, error: "LOAD_FAILED", message }, { status: 500 });
  }
}
