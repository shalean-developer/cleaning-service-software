import { NextResponse } from "next/server";
import { runAdminSupportDispatchOffer } from "@/features/assignments/server/adminSupportDispatchOffer";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const record = body as { cleanerId?: unknown; reason?: unknown };

  const result = await runAdminSupportDispatchOffer(user, bookingId, {
    cleanerId: typeof record.cleanerId === "string" ? record.cleanerId : "",
    reason: typeof record.reason === "string" ? record.reason : "",
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    bookingId: result.bookingId,
    bookingStatus: result.bookingStatus,
    cleanerId: result.cleanerId,
    offerId: result.offerId ?? null,
    idempotent: result.idempotent ?? false,
    message: result.message,
  });
}
