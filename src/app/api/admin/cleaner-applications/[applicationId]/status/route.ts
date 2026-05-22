import { updateCleanerApplicationStatus } from "@/features/cleaner-applications/server/adminCleanerApplicationsReadModel";
import { cleanerApplicationStatusUpdateSchema } from "@/features/cleaner-applications/schema";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

type RouteContext = { params: Promise<{ applicationId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return Response.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { applicationId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "JSON body required." },
      { status: 400 },
    );
  }

  const parsed = cleanerApplicationStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Invalid status payload." },
      { status: 400 },
    );
  }

  const result = await updateCleanerApplicationStatus(user, applicationId, {
    status: parsed.data.status,
    adminNotes: parsed.data.adminNotes,
  });

  if (!result.ok) {
    return Response.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return Response.json({ ok: true, message: "Application updated." });
}
