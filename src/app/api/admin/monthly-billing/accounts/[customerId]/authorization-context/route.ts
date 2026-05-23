import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadMonthlyAccountAuthorizationContext } from "@/features/monthly-billing/server/loadMonthlyAccountAuthorizationContext";
import { isUuid } from "@/lib/validation/uuid";

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
  if (!isUuid(customerId)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "customerId must be a valid UUID." },
      { status: 400 },
    );
  }

  try {
    const authorizationContext = await loadMonthlyAccountAuthorizationContext(customerId);
    return NextResponse.json({ ok: true, context: authorizationContext });
  } catch {
    return NextResponse.json(
      { ok: false, error: "LOAD_FAILED", message: "Could not load authorization context." },
      { status: 500 },
    );
  }
}
