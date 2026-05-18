import { deactivateCleaner } from "@/features/cleaners/server/lifecycle/deactivateCleaner";
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
    return Response.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = parseLifecycleRouteBody(body);
  const reason = readOptionalString(parsed.reason) ?? "";

  const result = await deactivateCleaner({
    ...buildLifecycleBaseParams(user, cleanerId, parsed),
    reason,
    lifecycleReason: reason,
  });

  return lifecycleCommandJsonResponse(result);
}
