import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { executeApprovedBookingRescheduleRequest } from "@/features/support/server/executeApprovedBookingRescheduleRequest";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { requestId } = await context.params;

  let body: {
    newScheduledStart?: string;
    newScheduledEnd?: string;
    assignmentHandling?: string;
    adminNote?: string | null;
    customerResponse?: string | null;
    confirm?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  if (!body.newScheduledStart?.trim() || !body.newScheduledEnd?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_PAYLOAD",
        message: "newScheduledStart and newScheduledEnd are required.",
      },
      { status: 400 },
    );
  }

  const result = await executeApprovedBookingRescheduleRequest(user, {
    supportRequestId: requestId.trim(),
    newScheduledStart: body.newScheduledStart.trim(),
    newScheduledEnd: body.newScheduledEnd.trim(),
    assignmentHandling: body.assignmentHandling ?? "block_if_unavailable",
    adminNote: body.adminNote,
    customerResponse: body.customerResponse,
    confirm: body.confirm === true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json({
    ok: true,
    idempotent: result.idempotent,
    booking: result.booking,
    supportRequest: result.supportRequest,
    assignmentOutcome: result.assignmentOutcome,
    auditIdempotencyKey: result.auditIdempotencyKey,
  });
}
