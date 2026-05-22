import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { adminUpdateBookingSupportRequestStatus } from "@/features/bookings/server/bookingSupportRequestsService";
import type { BookingSupportRequestStatus } from "@/lib/database/types";
import { BOOKING_SUPPORT_REQUEST_STATUSES } from "@/lib/database/types";

type RouteContext = { params: Promise<{ requestId: string }> };

const VALID_STATUSES = new Set<BookingSupportRequestStatus>(
  BOOKING_SUPPORT_REQUEST_STATUSES.filter((s) => s !== "open"),
);

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { requestId } = await context.params;

  let body: { status?: string; customerResponse?: string | null; adminNotes?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const status = body.status as BookingSupportRequestStatus;
  if (!status || !VALID_STATUSES.has(status)) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_PAYLOAD",
        message: "status must be acknowledged, resolved, or rejected.",
      },
      { status: 400 },
    );
  }

  const result = await adminUpdateBookingSupportRequestStatus(user, requestId.trim(), status, {
    customerResponse: body.customerResponse,
    adminNotes: body.adminNotes,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json({ ok: true, message: result.message });
}
