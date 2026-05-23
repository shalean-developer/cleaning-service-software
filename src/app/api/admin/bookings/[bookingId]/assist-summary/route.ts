import { NextResponse } from "next/server";
import { loadAdminBookingAssistSummary } from "@/features/bookings/server/admin/loadAdminBookingAssistSummary";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { bookingId } = await context.params;

  try {
    const summary = await loadAdminBookingAssistSummary(bookingId);
    if (!summary) {
      return NextResponse.json(
        { ok: false, error: "NOT_FOUND", message: "Admin-assisted booking not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load assist summary.";
    return NextResponse.json({ ok: false, error: "LOAD_FAILED", message }, { status: 500 });
  }
}
