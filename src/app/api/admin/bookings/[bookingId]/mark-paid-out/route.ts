import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { markBookingPaidOutAdmin } from "@/features/earnings/server/completionActions";

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { bookingId } = await context.params;
  let payoutBatchId: string | null = null;
  try {
    const body = (await request.json()) as { payoutBatchId?: string };
    if (typeof body.payoutBatchId === "string") payoutBatchId = body.payoutBatchId;
  } catch {
    // empty body is fine
  }

  const result = await markBookingPaidOutAdmin(user, bookingId, payoutBatchId);
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
