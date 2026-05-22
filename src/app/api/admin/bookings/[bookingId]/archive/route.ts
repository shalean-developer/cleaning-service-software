import { z } from "zod";
import { archiveBookingAdminCommand } from "@/features/admin/server/entityArchive/archiveBookingAdminCommand";
import { adminArchiveRouteResponse } from "@/features/admin/server/entityArchive/adminArchiveRouteResponse";
import {
  parseAdminArchiveBody,
  validateConfirmPhrase,
} from "@/features/admin/server/entityArchive/parseAdminArchiveBody";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

const bookingIdSchema = z.string().uuid();
const CONFIRM_PHRASE = "DELETE BOOKING";

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return Response.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { bookingId: rawBookingId } = await context.params;
  const parsedId = bookingIdSchema.safeParse(rawBookingId);
  if (!parsedId.success) {
    return Response.json(
      { ok: false, error: "INVALID_BOOKING_ID", message: "bookingId must be a valid UUID." },
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

  const confirmError = validateConfirmPhrase(parsed.data.confirmPhrase, CONFIRM_PHRASE);
  if (confirmError) {
    return Response.json(
      { ok: false, error: "CONFIRMATION_REQUIRED", message: confirmError },
      { status: 400 },
    );
  }

  const result = await archiveBookingAdminCommand({
    bookingId: parsedId.data,
    adminProfileId: user.profileId,
    reason: parsed.data.reason,
    action: parsed.data.action,
    idempotencyKey: parsed.data.idempotencyKey ?? null,
  });

  return adminArchiveRouteResponse(result);
}
