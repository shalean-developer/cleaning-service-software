import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { recordAdminTeamRequestFulfillment } from "@/features/dashboards/server/recordAdminTeamRequestFulfillment";

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { bookingId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const record = body as { fulfilledCleanerCount?: unknown };
  const count = record.fulfilledCleanerCount;
  if (count !== 1 && count !== 2) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_PAYLOAD",
        message: "fulfilledCleanerCount must be 1 or 2.",
      },
      { status: 400 },
    );
  }

  const result = await recordAdminTeamRequestFulfillment(user, bookingId, count);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json({ ok: true, fulfillment: result.fulfillment });
}
