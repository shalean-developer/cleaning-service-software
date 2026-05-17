import { NextResponse } from "next/server";
import { adminRequeueNotificationOutbox } from "@/features/notifications/server/adminRequeueNotificationOutbox";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

type RouteContext = { params: Promise<{ outboxId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { outboxId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const record = body as { reason?: unknown };
  const result = await adminRequeueNotificationOutbox(user, outboxId, {
    reason: typeof record.reason === "string" ? record.reason : "",
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        outcome: result.outcome,
        error: result.code,
        message: result.message,
        deliveryDedupeWouldBlock: result.deliveryDedupeWouldBlock ?? undefined,
      },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json({
    ok: true,
    outcome: result.outcome,
    outboxId: result.outboxId,
    bookingId: result.bookingId,
    template: result.template,
    status: result.status,
    deliveryDedupeWouldBlock: result.deliveryDedupeWouldBlock,
    message: result.message,
  });
}
