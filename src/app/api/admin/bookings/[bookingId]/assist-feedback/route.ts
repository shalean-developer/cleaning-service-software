import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { recordAdminAssistedOperatorFeedback } from "@/features/bookings/server/admin/loadAdminAssistedOperatorFeedback";
import { isAdminAssistedBookingMetadata } from "@/features/bookings/server/admin/adminAssistMetadata";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

type RouteContext = { params: Promise<{ bookingId: string }> };

function parseOptionalBoolean(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

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

  const payload = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const confusingText =
    typeof (payload as Record<string, unknown>).confusingText === "string"
      ? (payload as Record<string, unknown>).confusingText
      : null;
  const slowedDownText =
    typeof (payload as Record<string, unknown>).slowedDownText === "string"
      ? (payload as Record<string, unknown>).slowedDownText
      : null;
  const notes =
    typeof (payload as Record<string, unknown>).notes === "string"
      ? (payload as Record<string, unknown>).notes
      : null;

  const client = requireServiceRoleClient();
  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select("id, metadata")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    return NextResponse.json(
      { ok: false, error: "LOAD_FAILED", message: bookingError.message },
      { status: 500 },
    );
  }
  if (!booking || !isAdminAssistedBookingMetadata(booking.metadata)) {
    return NextResponse.json(
      { ok: false, error: "NOT_FOUND", message: "Admin-assisted booking not found." },
      { status: 404 },
    );
  }

  try {
    const feedback = await recordAdminAssistedOperatorFeedback(
      {
        bookingId,
        adminProfileId: user.profileId,
        confusingText: confusingText as string | null,
        slowedDownText: slowedDownText as string | null,
        paymentSucceeded: parseOptionalBoolean(
          (payload as Record<string, unknown>).paymentSucceeded,
        ),
        customerUnderstood: parseOptionalBoolean(
          (payload as Record<string, unknown>).customerUnderstood,
        ),
        notes: notes as string | null,
      },
      client,
    );

    return NextResponse.json({ ok: true, feedback });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save feedback.";
    return NextResponse.json({ ok: false, error: "SAVE_FAILED", message }, { status: 500 });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { bookingId } = await context.params;
  const { loadAdminAssistedOperatorFeedbackForBooking } = await import(
    "@/features/bookings/server/admin/loadAdminAssistedOperatorFeedback"
  );

  try {
    const feedback = await loadAdminAssistedOperatorFeedbackForBooking(bookingId);
    return NextResponse.json({ ok: true, feedback });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load feedback.";
    return NextResponse.json({ ok: false, error: "LOAD_FAILED", message }, { status: 500 });
  }
}
