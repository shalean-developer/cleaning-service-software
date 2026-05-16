import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { assertCleanerApiPayloadClean } from "@/features/dashboards/server/cleanerApiPayload";
import { getCleanerJobDetail } from "@/features/dashboards/server/cleanerJobReadModel";

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser(["cleaner"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { bookingId } = await context.params;
  const result = await getCleanerJobDetail(user, bookingId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  const payload = { ok: true as const, job: result.job };
  assertCleanerApiPayloadClean(payload);
  return NextResponse.json(payload);
}
