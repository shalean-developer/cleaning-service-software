import { updateCleanerProfile } from "@/features/cleaners/server/admin/updateCleanerProfile";
import { mapUpdateCleanerProfileHttpStatus } from "@/features/cleaners/server/admin/mapUpdateCleanerProfileHttpStatus";
import { parseUpdateCleanerProfileBody } from "@/features/cleaners/server/admin/parseUpdateCleanerProfileBody";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

type RouteContext = { params: Promise<{ cleanerId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
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

  const parsed = parseUpdateCleanerProfileBody(body);
  if (!parsed.ok) {
    return Response.json(
      { ok: false, error: parsed.code, message: parsed.message },
      {
        status: mapUpdateCleanerProfileHttpStatus({
          ok: false,
          code: parsed.code,
          message: parsed.message,
        }),
      },
    );
  }

  const result = await updateCleanerProfile({
    cleanerId,
    adminProfileId: user.profileId,
    fullName: parsed.values.fullName,
    serviceAreasInput: parsed.values.serviceAreasInput,
    capabilities: parsed.values.capabilities,
    workingDays: parsed.values.workingDays,
    startTime: parsed.values.startTime,
    endTime: parsed.values.endTime,
    timezone: parsed.values.timezone,
    idempotencyKey: parsed.values.idempotencyKey,
  });

  const status = mapUpdateCleanerProfileHttpStatus(result);
  if (result.ok) {
    return Response.json(
      {
        ok: true,
        cleanerId: result.cleanerId,
        auditId: result.auditId,
        message: result.message,
      },
      { status },
    );
  }

  return Response.json(
    {
      ok: false,
      error: result.code,
      message: result.message,
    },
    { status },
  );
}
