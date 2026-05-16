import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { getOfferById } from "@/features/assignments/server/offerRepository";
import { acceptCleanerOffer } from "@/features/assignments/server/respondToOffer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";

type RouteContext = { params: Promise<{ offerId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (user.role !== "cleaner") {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN", message: "Only cleaners can accept offers." },
      { status: 403 },
    );
  }

  const { offerId } = await context.params;
  const client = await createSupabaseServerClient();
  if (!client) {
    return NextResponse.json(
      { ok: false, error: "AUTH_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const scope = await resolveActorScope(client, user.profileId, user.role);
  if (!scope.actingCleanerId) {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN", message: "Cleaner profile not linked." },
      { status: 403 },
    );
  }

  const offer = await getOfferById(client, offerId);
  if (!offer) {
    return NextResponse.json(
      { ok: false, error: "OFFER_NOT_FOUND", message: "Offer not found." },
      { status: 404 },
    );
  }

  const backend = createBookingCommandBackend();
  const result = await acceptCleanerOffer(
    backend,
    offer,
    scope.actingCleanerId,
    user.profileId,
  );

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.code === "FORBIDDEN" ? 403 : 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    bookingId: result.bookingId,
    status: result.status,
    idempotent: result.idempotent,
  });
}
