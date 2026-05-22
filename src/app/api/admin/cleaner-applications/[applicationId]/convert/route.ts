import { convertApplicationToCleaner } from "@/features/cleaner-applications/server/convertApplicationToCleaner";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

type RouteContext = { params: Promise<{ applicationId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return Response.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { applicationId } = await context.params;
  const result = await convertApplicationToCleaner(user, applicationId);

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return Response.json({
    ok: true,
    cleanerId: result.cleanerId,
    message: result.message,
    dispatchEligible: result.dispatchEligible,
  });
}
