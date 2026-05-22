import { getAdminCleanerApplicationDetail } from "@/features/cleaner-applications/server/adminCleanerApplicationsReadModel";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

type RouteContext = { params: Promise<{ applicationId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return Response.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { applicationId } = await context.params;
  const result = await getAdminCleanerApplicationDetail(user, applicationId);

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return Response.json({ ok: true, application: result.application });
}
