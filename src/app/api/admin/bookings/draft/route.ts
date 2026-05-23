import { NextResponse } from "next/server";
import { adminCreateBookingDraftFacade } from "@/features/bookings/server/admin/adminCreateBookingDraftFacade";
import { parseAdminCreateBookingDraftBody } from "@/features/bookings/server/admin/parseAdminCreateBookingDraftBody";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

export async function POST(request: Request) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = parseAdminCreateBookingDraftBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.code, message: parsed.message },
      { status: 400 },
    );
  }

  const result = await adminCreateBookingDraftFacade({
    admin: user,
    body: parsed.values,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    bookingDraft: result.bookingDraft,
  });
}
