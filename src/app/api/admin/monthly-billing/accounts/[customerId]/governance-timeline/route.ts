import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadMonthlyGovernanceTimelineForCustomer } from "@/features/monthly-billing/server/loadMonthlyGovernanceTimelineForCustomer";

type RouteContext = { params: Promise<{ customerId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { customerId } = await context.params;

  try {
    const timeline = await loadMonthlyGovernanceTimelineForCustomer(customerId);
    return NextResponse.json({ ok: true, timeline });
  } catch {
    return NextResponse.json(
      { ok: false, error: "LOAD_FAILED", message: "Could not load governance timeline." },
      { status: 500 },
    );
  }
}
