import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { listProductionRolloutChecklist } from "@/features/production-rollout/server/productionRolloutChecklistRepository";

export async function GET() {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  try {
    const checklist = await listProductionRolloutChecklist();
    return NextResponse.json({ ok: true, checklist });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Could not load rollout checklist.",
      },
      { status: 500 },
    );
  }
}
