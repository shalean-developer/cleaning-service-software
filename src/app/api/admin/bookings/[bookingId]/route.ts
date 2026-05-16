import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { getAdminBookingDetail } from "@/features/dashboards/server/adminOperationsReadModel";

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
  const result = await getAdminBookingDetail(user, bookingId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, booking: result.booking });
}
