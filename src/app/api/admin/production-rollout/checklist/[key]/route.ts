import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { updateProductionRolloutChecklistItem } from "@/features/production-rollout/server/productionRolloutChecklistRepository";
import type { ProductionRolloutChecklistKey } from "@/features/production-rollout/server/productionRolloutTypes";
import { PRODUCTION_ROLLOUT_CHECKLIST_KEYS } from "@/features/production-rollout/server/productionRolloutTypes";

type RouteContext = {
  params: Promise<{ key: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { key } = await context.params;
  const checklistKey = key.trim() as ProductionRolloutChecklistKey;

  if (!PRODUCTION_ROLLOUT_CHECKLIST_KEYS.includes(checklistKey)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_KEY", message: "Unknown checklist key." },
      { status: 400 },
    );
  }

  let body: { completed?: boolean; notes?: string };
  try {
    body = (await request.json()) as { completed?: boolean; notes?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (typeof body.completed !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "INVALID_BODY", message: "completed must be a boolean." },
      { status: 400 },
    );
  }

  try {
    const item = await updateProductionRolloutChecklistItem({
      checklistKey,
      completed: body.completed,
      notes: body.notes,
      adminProfileId: user.id,
    });
    return NextResponse.json({ ok: true, item });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "UPDATE_FAILED",
        message: "Could not update checklist item.",
      },
      { status: 500 },
    );
  }
}
