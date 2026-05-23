import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { loadAdminAssistQaChecklist, upsertAdminAssistQaChecklist } from "@/features/bookings/server/admin/loadAdminAssistQaChecklist";
import { parseAdminAssistQaChecklistItems } from "@/features/bookings/adminAssistQaChecklistShared";
import { isAdminAssistedBookingMetadata } from "@/features/bookings/server/admin/adminAssistMetadata";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";

type RouteContext = { params: Promise<{ bookingId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireApiUser(["admin"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const { bookingId } = await context.params;

  try {
    const checklist = await loadAdminAssistQaChecklist(bookingId);
    return NextResponse.json({ ok: true, checklist });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load checklist.";
    return NextResponse.json({ ok: false, error: "LOAD_FAILED", message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
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

  const items = parseAdminAssistQaChecklistItems(
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).items
      : null,
  );

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
    const checklist = await upsertAdminAssistQaChecklist({
      bookingId,
      adminProfileId: user.profileId,
      items,
      client,
    });
    return NextResponse.json({ ok: true, checklist });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save checklist.";
    return NextResponse.json({ ok: false, error: "SAVE_FAILED", message }, { status: 500 });
  }
}
