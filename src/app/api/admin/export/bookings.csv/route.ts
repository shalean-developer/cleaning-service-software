import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { exportAdminBookingsCsv } from "@/features/dashboards/server/adminOperationsReadModel";
import { parseAdminBookingsQueryParams } from "@/features/dashboards/server/parseAdminBookingsQueryParams";
import { ADMIN_BOOKINGS_EXPORT_LIMIT } from "@/features/dashboards/server/adminBookingsExport";

export async function GET(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const query = parseAdminBookingsQueryParams(new URL(request.url).searchParams);
  const result = await exportAdminBookingsCsv(user, query);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  const headers = new Headers({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${result.filename}"`,
    "X-Export-Returned-Count": String(result.returnedCount),
    "X-Export-Truncated": String(result.truncated),
    "X-Export-Cap": String(ADMIN_BOOKINGS_EXPORT_LIMIT),
  });

  if (result.matchTotal !== null) {
    headers.set("X-Export-Match-Total", String(result.matchTotal));
  }

  return new NextResponse(result.csv, { status: 200, headers });
}
