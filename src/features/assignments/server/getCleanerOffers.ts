import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AssignmentOfferRow, BookingRow, Database } from "@/lib/database/types";
import { listOffersForCleaner } from "./offerRepository";
import { isOfferPastExpiry } from "./buildOfferExpiry";

export type CleanerOfferView = {
  offer: AssignmentOfferRow;
  booking: Pick<
    BookingRow,
    "id" | "scheduled_start" | "scheduled_end" | "status" | "price_cents" | "currency"
  >;
};

export async function getCleanerOffers(
  user: CurrentUser,
): Promise<
  | { ok: true; offers: CleanerOfferView[] }
  | { ok: false; code: string; message: string; status: number }
> {
  if (user.role !== "cleaner") {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Only cleaners can list assignment offers.",
      status: 403,
    };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    return {
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      message: "Supabase is not configured.",
      status: 503,
    };
  }

  const ctx = await resolveActorScope(client, user.profileId, user.role);
  if (!ctx.actingCleanerId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Cleaner profile is not linked.",
      status: 403,
    };
  }

  const offers = await listOffersForCleaner(client, ctx.actingCleanerId, ["offered"]);
  const views: CleanerOfferView[] = [];

  for (const offer of offers) {
    if (isOfferPastExpiry(offer.expires_at)) continue;

    const { data: booking, error } = await client
      .from("bookings")
      .select("id, scheduled_start, scheduled_end, status, price_cents, currency")
      .eq("id", offer.booking_id)
      .maybeSingle();

    if (error || !booking) continue;
    if (booking.status !== "pending_assignment") continue;

    views.push({ offer, booking });
  }

  return { ok: true, offers: views };
}
