import { NextResponse } from "next/server";
import { authorizeMonthlyAccountServiceFacade } from "@/features/bookings/server/admin/authorizeMonthlyAccountServiceFacade";
import { parseAuthorizeMonthlyServiceBody } from "@/features/bookings/server/admin/parseAuthorizeMonthlyServiceBody";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { isUuid } from "@/lib/validation/uuid";

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { bookingId } = await context.params;
  if (!isUuid(bookingId)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "bookingId must be a valid UUID." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = parseAuthorizeMonthlyServiceBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.code, message: parsed.message },
      { status: 400 },
    );
  }

  const result = await authorizeMonthlyAccountServiceFacade({
    admin: user,
    bookingId,
    body: parsed.values,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    booking: result.booking,
    authorization: result.authorization,
    idempotent: result.idempotent,
  });
}
