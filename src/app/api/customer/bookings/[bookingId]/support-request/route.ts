import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { customerCreateBookingSupportRequest } from "@/features/bookings/server/bookingSupportRequestsService";

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["customer"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { bookingId } = await context.params;

  let body: {
    requestType?: string;
    message?: string;
    preferredNewTime?: string;
    confirmCancel?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  if (typeof body.requestType !== "string" || !body.requestType.trim()) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "requestType is required." },
      { status: 400 },
    );
  }

  const result = await customerCreateBookingSupportRequest(user, bookingId.trim(), {
    requestType: body.requestType.trim(),
    message: body.message,
    preferredNewTime: body.preferredNewTime,
    confirmCancel: body.confirmCancel === true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    requestId: result.requestId,
  });
}
