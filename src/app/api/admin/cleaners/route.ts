import { createCleaner } from "@/features/cleaners/server/admin/createCleaner";
import { mapCreateCleanerHttpStatus } from "@/features/cleaners/server/admin/mapCreateCleanerHttpStatus";
import { parseCreateCleanerBody } from "@/features/cleaners/server/admin/parseCreateCleanerBody";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

export async function POST(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return Response.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = parseCreateCleanerBody(body);
  if (!parsed.ok) {
    return Response.json(
      { ok: false, error: parsed.code, message: parsed.message },
      { status: mapCreateCleanerHttpStatus({ ok: false, code: parsed.code, message: parsed.message }) },
    );
  }

  const result = await createCleaner({
    adminProfileId: user.profileId,
    fullName: parsed.values.fullName,
    phone: parsed.values.phone,
    password: parsed.values.password,
    confirmPassword: parsed.values.confirmPassword,
    serviceAreasInput: parsed.values.serviceAreasInput,
    capabilities: parsed.values.capabilities,
    workingDays: parsed.values.workingDays,
    startTime: parsed.values.startTime,
    endTime: parsed.values.endTime,
    timezone: parsed.values.timezone,
    idempotencyKey: parsed.values.idempotencyKey,
  });

  const status = mapCreateCleanerHttpStatus(result);
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
