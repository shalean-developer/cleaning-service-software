import { requestedTeamSizeForPricingInput } from "./resolveRequestedTeamSize";
import type { PricingBreakdown, PricingInput } from "./types";

/**
 * Snapshot to persist on `bookings.metadata` when creating a draft from a quote.
 * Wizard / lock phases should store this verbatim for audit and earnings (Phase 10).
 */
export function buildBookingQuoteMetadata(
  input: PricingInput,
  breakdown: PricingBreakdown,
): Record<string, unknown> {
  return {
    pricingVersion: breakdown.pricingVersion,
    quote: {
      input: {
        serviceSlug: input.serviceSlug,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        extraRooms: input.extraRooms ?? 0,
        cleaningIntensity: input.cleaningIntensity ?? "standard",
        equipmentSupply: input.equipmentSupply ?? "customer",
        propertySizeSqm: input.propertySizeSqm ?? null,
        frequency: input.frequency ?? "once",
        addons: input.addons ?? [],
        teamSize: 1,
        requestedTeamSize: requestedTeamSizeForPricingInput(input),
      },
      breakdown: {
        lineItems: breakdown.lineItems,
        subtotalCents: breakdown.subtotalCents,
        discountCents: breakdown.discountCents,
        totalCents: breakdown.totalCents,
        currency: breakdown.currency,
      },
      cleanerEarningsPreview: breakdown.cleanerEarnings,
    },
  };
}
