import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { adminResolveRecurringSeriesRequest } from "@/features/recurring/server/recurringSeriesRequestsService";

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
  let body: { acknowledgeOnly?: boolean; reject?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const result = await adminResolveRecurringSeriesRequest(user, requestId, {
    acknowledgeOnly: body.acknowledgeOnly === true,
    reject: body.reject === true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }

  return NextResponse.json({ ok: true, message: result.message });
}
