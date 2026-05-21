import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { adminCancelRecurringSeries } from "@/features/recurring/server/recurringSeriesCommandService";

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
  let body: { reason?: string; confirm?: boolean } = {};
  try {
    body = (await request.json()) as { reason?: string; confirm?: boolean };
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      {
        ok: false,
        error: "CONFIRMATION_REQUIRED",
        message: "Set confirm: true to cancel the entire series.",
      },
      { status: 400 },
    );
  }

  const result = await adminCancelRecurringSeries(
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
