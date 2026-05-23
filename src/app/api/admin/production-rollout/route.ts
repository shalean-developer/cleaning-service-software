import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadProductionRolloutStatus } from "@/features/production-rollout/server/productionRolloutReadModel";

export async function GET() {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  try {
    const status = await loadProductionRolloutStatus();
    return NextResponse.json({
      ok: true,
      environment: status.environment,
      featureFlags: status.featureFlags,
      operationalHealth: status.operationalHealth,
      rolloutReadiness: status.rolloutReadiness,
      recommendedNextSteps: status.recommendedNextSteps,
      featureFlagRecommendations: status.featureFlagRecommendations,
      checklist: status.checklist,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Could not load production rollout status.",
      },
      { status: 500 },
    );
  }
}
