import "server-only";

import type { BookingRow } from "@/lib/database/types";
import { computeEarningsForBooking } from "./computeEarningsForBooking";

export type TeamEarningsPoolResult =
  | {
      ok: true;
      totalPoolCents: number;
      grossAmountCents: number;
      calculationMetadata: Record<string, unknown>;
    }
  | { ok: false; code: string; message: string };

/**
 * Total cleaner payout pool for a booking (per-cleaner quote × team size).
 */
export function resolveTeamEarningsPool(booking: BookingRow): TeamEarningsPoolResult {
  const computed = computeEarningsForBooking(booking);
  if (!("payoutAmountCents" in computed)) {
    return { ok: false, code: computed.code, message: computed.message };
  }

  const meta = computed.calculationMetadata;
  const totalFromMeta =
    typeof meta.totalCleanerPayoutCents === "number"
      ? meta.totalCleanerPayoutCents
      : computed.payoutAmountCents * (computed.teamSize ?? 1);

  const totalPoolCents = Math.round(totalFromMeta);
  if (totalPoolCents <= 0) {
    return {
      ok: false,
      code: "EARNINGS_INVALID",
      message: "Team earnings pool must be greater than zero.",
    };
  }

  return {
    ok: true,
    totalPoolCents,
    grossAmountCents: computed.grossAmountCents,
    calculationMetadata: meta,
  };
}
