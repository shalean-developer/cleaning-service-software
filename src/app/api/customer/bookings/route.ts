import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { listCustomerBookings } from "@/features/dashboards/server/customerBookingReadModel";

export async function GET() {
  const user = await requireApiUser(["customer"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const result = await listCustomerBookings(user);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, bookings: result.bookings });
}
