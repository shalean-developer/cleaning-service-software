import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { assertCleanerApiPayloadClean } from "@/features/dashboards/server/cleanerApiPayload";
import { listCleanerOffersForDashboard } from "@/features/dashboards/server/cleanerJobReadModel";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await listCleanerOffersForDashboard(user);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.code, message: result.message },
      { status: result.status },
    );
  }

  const payload = {
    ok: true as const,
    offers: result.offers.map((offer) => ({
      offerId: offer.offerId,
      bookingId: offer.bookingId,
      status: offer.status,
      expiresAt: offer.expiresAt,
      offeredAt: offer.offeredAt,
      scheduleLabel: offer.scheduleLabel,
      locationSummary: offer.locationSummary,
      serviceLabel: offer.serviceLabel,
      earningsCents: offer.earningsCents,
      earningsLabel: offer.earningsLabel,
      isExpired: offer.isExpired,
      teamRoleLabel: offer.teamRoleLabel,
    })),
  };

  assertCleanerApiPayloadClean(payload);

  return NextResponse.json(payload);
}
