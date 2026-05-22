import { z } from "zod";
import { adminArchiveRouteResponse } from "@/features/admin/server/entityArchive/adminArchiveRouteResponse";
import { hardDeleteBookingAdminCommand } from "@/features/admin/server/entityArchive/hardDeleteBookingAdminCommand";
import {
  BOOKING_HARD_DELETE_CONFIRM_PHRASE,
  parseAdminHardDeleteBody,
  validateBookingHardDeleteConfirmPhrase,
} from "@/features/admin/server/entityArchive/parseAdminHardDeleteBody";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

const bookingIdSchema = z.string().uuid();

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

  const parsed = parseAdminHardDeleteBody(body);
  if (!parsed.ok) {
    return Response.json(
      { ok: false, error: "INVALID_PAYLOAD", message: parsed.message },
      { status: 400 },
    );
  }

  const confirmError = validateBookingHardDeleteConfirmPhrase(parsed.data.confirmPhrase);
  if (confirmError) {
    return Response.json(
      { ok: false, error: "CONFIRMATION_REQUIRED", message: confirmError },
      { status: 400 },
    );
  }

  const result = await hardDeleteBookingAdminCommand({
    bookingId: parsedId.data,
    adminProfileId: user.profileId,
    reason: parsed.data.reason,
    idempotencyKey: parsed.data.idempotencyKey ?? null,
  });

  return adminArchiveRouteResponse(result);
}
