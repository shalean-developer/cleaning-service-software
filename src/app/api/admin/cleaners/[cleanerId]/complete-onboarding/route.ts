import { completeCleanerOnboarding } from "@/features/cleaners/server/lifecycle/completeCleanerOnboarding";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import {
  buildLifecycleBaseParams,
  lifecycleCommandJsonResponse,
  parseLifecycleRouteBody,
  readOptionalString,
} from "@/features/cleaners/server/admin/adminCleanerLifecycleRouteSupport";

type RouteContext = { params: Promise<{ cleanerId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return Response.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { cleanerId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = parseLifecycleRouteBody(body);
  const lifecycleReason = readOptionalString(parsed.reason) ?? null;

  const result = await completeCleanerOnboarding({
    ...buildLifecycleBaseParams(user, cleanerId, parsed),
    lifecycleReason,
  });

  return lifecycleCommandJsonResponse(result);
}
