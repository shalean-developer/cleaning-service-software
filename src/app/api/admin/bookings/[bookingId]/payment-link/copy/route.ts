import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRecordPaymentLinkCopiedFacade } from "@/features/bookings/server/admin/adminRecordPaymentLinkCopiedFacade";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

const copyBodySchema = z.object({
  customerId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { bookingId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "INVALID_PAYLOAD", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = copyBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_PAYLOAD",
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
      },
      { status: 400 },
    );
  }

  const result = await adminRecordPaymentLinkCopiedFacade({
    admin: user,
    bookingId,
    body: parsed.data,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true, recorded: true });
}
