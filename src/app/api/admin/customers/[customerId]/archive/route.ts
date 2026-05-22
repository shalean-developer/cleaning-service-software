import { z } from "zod";
import {
  ARCHIVE_CUSTOMER_CONFIRM_PHRASE,
  CUSTOMER_HARD_DELETE_CONFIRM_PHRASE,
} from "@/features/admin/adminEntityArchiveEligibility";
import { archiveCustomerAdminCommand } from "@/features/admin/server/entityArchive/archiveCustomerAdminCommand";
import { adminArchiveRouteResponse } from "@/features/admin/server/entityArchive/adminArchiveRouteResponse";
import {
  parseAdminArchiveBody,
  validateConfirmPhrase,
} from "@/features/admin/server/entityArchive/parseAdminArchiveBody";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

const customerIdSchema = z.string().uuid();

type RouteContext = { params: Promise<{ customerId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return Response.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { customerId: rawCustomerId } = await context.params;
  const parsedId = customerIdSchema.safeParse(rawCustomerId);
  if (!parsedId.success) {
    return Response.json(
      { ok: false, error: "INVALID_CUSTOMER_ID", message: "customerId must be a valid UUID." },
      { status: 400 },
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

  const parsed = parseAdminArchiveBody(body);
  if (!parsed.ok) {
    return Response.json(
      { ok: false, error: "INVALID_PAYLOAD", message: parsed.message },
      { status: 400 },
    );
  }

  const action = parsed.data.action ?? "archive";
  const confirmPhrase =
    action === "delete" ? CUSTOMER_HARD_DELETE_CONFIRM_PHRASE : ARCHIVE_CUSTOMER_CONFIRM_PHRASE;
  const confirmError = validateConfirmPhrase(parsed.data.confirmPhrase, confirmPhrase);
  if (confirmError) {
    return Response.json(
      { ok: false, error: "CONFIRMATION_REQUIRED", message: confirmError },
      { status: 400 },
    );
  }

  const result = await archiveCustomerAdminCommand({
    customerId: parsedId.data,
    adminProfileId: user.profileId,
    reason: parsed.data.reason,
    action,
    idempotencyKey: parsed.data.idempotencyKey ?? null,
  });

  return adminArchiveRouteResponse(result);
}
