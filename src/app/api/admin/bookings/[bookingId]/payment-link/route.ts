import { NextResponse } from "next/server";
import { adminGeneratePaymentLinkFacade } from "@/features/bookings/server/admin/adminGeneratePaymentLinkFacade";
import { parseAdminGeneratePaymentLinkBody } from "@/features/bookings/server/admin/parseAdminGeneratePaymentLinkBody";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";

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

  const parsed = parseAdminGeneratePaymentLinkBody(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.code, message: parsed.message },
      { status: 400 },
    );
  }

  const result = await adminGeneratePaymentLinkFacade({
    admin: user,
    bookingId,
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
    paymentLink: result.paymentLink,
  });
}
