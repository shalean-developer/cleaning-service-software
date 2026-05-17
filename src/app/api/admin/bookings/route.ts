import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { listAdminBookings } from "@/features/dashboards/server/adminOperationsReadModel";
import { parseAdminBookingsQueryParams } from "@/features/dashboards/server/parseAdminBookingsQueryParams";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const query = parseAdminBookingsQueryParams(new URL(request.url).searchParams);
  const result = await listAdminBookings(user, query);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    bookings: result.bookings,
    matchTotal: result.matchTotal,
    returnedCount: result.returnedCount,
    limit: result.limit,
    capped: result.capped,
    subsetFiltered: result.subsetFiltered,
  });
}
