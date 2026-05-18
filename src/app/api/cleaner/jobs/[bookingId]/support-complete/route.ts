import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { markSupportParticipationCompleted } from "@/features/bookings/server/supportParticipationActions";

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { bookingId } = await context.params;
  let supportNote: string | null = null;
  try {
    const body = (await request.json()) as { supportNote?: string };
    if (typeof body.supportNote === "string") supportNote = body.supportNote;
  } catch {
    // empty body is fine
  }

  const result = await markSupportParticipationCompleted(user, bookingId, supportNote);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.httpStatus ?? 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    rosterId: result.rosterId,
    status: result.status,
    idempotent: result.idempotent,
  });
}
