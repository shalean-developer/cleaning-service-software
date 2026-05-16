import { NextResponse } from "next/server";
import { expireStaleAssignmentOffers } from "@/features/assignments/server/expireOffers";
import { verifyCronSecret } from "@/lib/cron/verifyCronSecret";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";

export const runtime = "nodejs";

/**
 * Offer expiry endpoint (Supabase Cron via pg_net, or manual fallback).
 * GET/POST with Authorization: Bearer $CRON_SECRET or x-cron-secret header.
 * See docs/operations/expire-assignment-offers-cron.md
 */
async function handleExpire(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED", message: "Invalid or missing cron secret." },
      { status: 401 },
    );
  }

  const client = createServiceRoleClient();
  if (!client) {
    return NextResponse.json(
      {
        ok: false,
        error: "AUTH_NOT_CONFIGURED",
        message: "Service role client not configured.",
      },
      { status: 503 },
    );
  }

  try {
    const backend = createBookingCommandBackend();
    const result = await expireStaleAssignmentOffers(client, backend);

    return NextResponse.json({
      ok: true,
      expiredCount: result.expiredCount,
      bookingIds: result.bookingIds,
      redispatchedBookingIds: result.redispatchedBookingIds,
      attentionBookingIds: result.attentionBookingIds,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Offer expiry failed.";
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleExpire(request);
}

export async function POST(request: Request) {
  return handleExpire(request);
}
