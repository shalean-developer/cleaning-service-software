import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { getCustomerBookingDetail } from "@/features/dashboards/server/customerBookingReadModel";

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser(["customer"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { bookingId } = await context.params;
  const result = await getCustomerBookingDetail(user, bookingId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, booking: result.booking });
}
