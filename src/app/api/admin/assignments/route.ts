import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { listAdminAssignmentQueue } from "@/features/dashboards/server/adminOperationsReadModel";

export async function GET() {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const result = await listAdminAssignmentQueue(user);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, items: result.items });
}
