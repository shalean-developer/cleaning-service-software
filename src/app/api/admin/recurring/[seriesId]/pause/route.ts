import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { adminPauseRecurringSeries } from "@/features/recurring/server/recurringSeriesCommandService";

type RouteContext = { params: Promise<{ seriesId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { seriesId } = await context.params;
  let body: { reason?: string } = {};
  try {
    body = (await request.json()) as { reason?: string };
  } catch {
    /* optional body */
  }

  const result = await adminPauseRecurringSeries(
    user,
    seriesId,
    typeof body.reason === "string" ? body.reason : undefined,
  );
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }
  return NextResponse.json({ ok: true, message: result.message, idempotent: result.idempotent });
}
