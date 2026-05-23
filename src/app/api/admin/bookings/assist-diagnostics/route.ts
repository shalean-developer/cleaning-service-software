import { NextResponse } from "next/server";
import { loadAdminAssistedBookingDiagnostics } from "@/features/bookings/server/admin/adminAssistedBookingDiagnosticsReadModel";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

export async function GET() {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  try {
    const diagnostics = await loadAdminAssistedBookingDiagnostics();
    return NextResponse.json({ ok: true, diagnostics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load diagnostics.";
    return NextResponse.json({ ok: false, error: "LOAD_FAILED", message }, { status: 500 });
  }
}
