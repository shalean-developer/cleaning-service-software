import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { markBookingPayoutReadyAdmin } from "@/features/earnings/server/completionActions";

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { bookingId } = await context.params;
  const result = await markBookingPayoutReadyAdmin(user, bookingId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus ?? 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    bookingId: result.bookingId,
    status: result.status,
    idempotent: result.idempotent,
  });
}
