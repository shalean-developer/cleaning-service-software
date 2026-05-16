import "server-only";

import type { BookingRow } from "@/lib/database/types";
import { computeCleanerEarningsPreview } from "@/features/pricing/server/computeCleanerEarnings";
import { isServiceSlug } from "@/features/pricing/server/catalog";
import type { PricingInput, ServiceSlug } from "@/features/pricing/server/types";
import type { CleanerEarningsPreview, PricingQuoteFailure } from "@/features/pricing/server/types";
import type { EarningsCalculationResult } from "./types";

function isPricingFailure(
  value: CleanerEarningsPreview | PricingQuoteFailure,
): value is PricingQuoteFailure {
  return "ok" in value && value.ok === false;
}

function asRecord(metadata: BookingRow["metadata"]): Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function pricingInputFromBooking(booking: BookingRow): PricingInput | null {
  const record = asRecord(booking.metadata);
  const quote = record.quote;
  if (quote != null && typeof quote === "object" && !Array.isArray(quote)) {
    const q = quote as Record<string, unknown>;
    const input = q.input;
    if (input != null && typeof input === "object" && !Array.isArray(input)) {
      const i = input as Record<string, unknown>;
      const slug = typeof i.serviceSlug === "string" ? i.serviceSlug : null;
      if (!slug || !isServiceSlug(slug)) return null;
      return {
        serviceSlug: slug,
        bedrooms: typeof i.bedrooms === "number" ? i.bedrooms : 2,
        bathrooms: typeof i.bathrooms === "number" ? i.bathrooms : 1,
        propertySizeSqm:
          typeof i.propertySizeSqm === "number" ? i.propertySizeSqm : undefined,
        frequency:
          i.frequency === "weekly" || i.frequency === "biweekly"
            ? i.frequency
            : "once",
        addons: Array.isArray(i.addons) ? (i.addons as PricingInput["addons"]) : undefined,
        teamSize: typeof i.teamSize === "number" && i.teamSize > 0 ? i.teamSize : 1,
      };
    }
  }

  const slug =
    typeof record.serviceSlug === "string"
      ? record.serviceSlug
      : typeof record.service_slug === "string"
        ? record.service_slug
        : null;
  if (!slug || !isServiceSlug(slug)) return null;
  return { serviceSlug: slug, bedrooms: 2, bathrooms: 1, teamSize: 1 };
}

function tenureMonthsFromPreview(metadata: Record<string, unknown>): number | null {
  const quote = metadata.quote;
  if (quote == null || typeof quote !== "object" || Array.isArray(quote)) return null;
  const preview = (quote as Record<string, unknown>).cleanerEarningsPreview;
  if (preview == null || typeof preview !== "object" || Array.isArray(preview)) return null;
  const meta = (preview as Record<string, unknown>).metadata;
  if (meta != null && typeof meta === "object" && !Array.isArray(meta)) {
    const months = (meta as Record<string, unknown>).cleanerTenureMonths;
    if (typeof months === "number") return months;
  }
  return null;
}

/**
 * Server-authoritative earnings for a completed booking (never trust client cents).
 */
export function computeEarningsForBooking(
  booking: BookingRow,
  options?: { cleanerTenureMonths?: number | null },
): EarningsCalculationResult | { ok: false; code: string; message: string } {
  if (!booking.cleaner_id) {
    return { ok: false, code: "EARNINGS_INVALID", message: "Booking has no assigned cleaner." };
  }
  if (!Number.isFinite(booking.price_cents) || booking.price_cents <= 0) {
    return {
      ok: false,
      code: "EARNINGS_INVALID",
      message: "Booking total must be positive to generate earnings.",
    };
  }

  const metadata = asRecord(booking.metadata);
  const pricingInput = pricingInputFromBooking(booking);
  if (!pricingInput) {
    return {
      ok: false,
      code: "EARNINGS_INVALID",
      message: "Booking is missing a pricing snapshot for earnings calculation.",
    };
  }

  const tenure =
    options?.cleanerTenureMonths ?? tenureMonthsFromPreview(metadata) ?? null;

  const preview = computeCleanerEarningsPreview({
    serviceSlug: pricingInput.serviceSlug as ServiceSlug,
    customerTotalCents: booking.price_cents,
    teamSize: pricingInput.teamSize ?? 1,
    cleanerTenureMonths: tenure,
  });

  if (isPricingFailure(preview)) {
    return {
      ok: false,
      code: "EARNINGS_INVALID",
      message: preview.message,
    };
  }

  const payoutAmountCents = preview.perCleanerAmountCents;
  if (payoutAmountCents <= 0) {
    return {
      ok: false,
      code: "EARNINGS_INVALID",
      message: "Computed payout must be greater than zero.",
    };
  }
  if (payoutAmountCents > booking.price_cents) {
    return {
      ok: false,
      code: "EARNINGS_INVALID",
      message: "Payout cannot exceed the customer booking total.",
    };
  }

  return {
    cleanerId: booking.cleaner_id,
    grossAmountCents: booking.price_cents,
    payoutAmountCents,
    teamSize: pricingInput.teamSize ?? 1,
    ruleApplied: preview.ruleApplied,
    calculationMetadata: {
      ...preview.metadata,
      ruleApplied: preview.ruleApplied,
      teamSize: pricingInput.teamSize ?? 1,
      totalCleanerPayoutCents: preview.totalCleanerPayoutCents,
      perCleanerAmountCents: preview.perCleanerAmountCents,
      customerTotalCents: booking.price_cents,
    },
  };
}
