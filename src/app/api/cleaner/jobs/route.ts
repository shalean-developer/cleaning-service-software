import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { assertCleanerApiPayloadClean } from "@/features/dashboards/server/cleanerApiPayload";
import { listCleanerJobs } from "@/features/dashboards/server/cleanerJobReadModel";

export async function GET() {
  const user = await requireApiUser(["cleaner"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const result = await listCleanerJobs(user);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  const payload = { ok: true as const, jobs: result.jobs };
  assertCleanerApiPayloadClean(payload);
  return NextResponse.json(payload);
}
