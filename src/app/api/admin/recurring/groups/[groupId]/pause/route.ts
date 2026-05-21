import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { adminPauseRecurringScheduleGroup } from "@/features/recurring/server/recurringGroupCommandService";

type RouteContext = { params: Promise<{ groupId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { groupId } = await context.params;
  const result = await adminPauseRecurringScheduleGroup(user, groupId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus },
    );
  }
  return NextResponse.json({
    ok: true,
    message: result.message,
    idempotent: result.idempotent,
  });
}
