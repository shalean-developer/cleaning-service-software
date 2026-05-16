import "server-only";

import { computeEarningsForBooking } from "@/features/earnings/server/computeEarningsForBooking";
import { computeCleanerEarningsPreview } from "@/features/pricing/server/computeCleanerEarnings";
import { isServiceSlug } from "@/features/pricing/server/catalog";
import type { PricingInput, ServiceSlug } from "@/features/pricing/server/types";
import type { BookingRow, Json } from "@/lib/database/types";
import { formatZar } from "./parseBookingDisplay";

export const EARNINGS_BEING_CALCULATED_LABEL = "Earnings being calculated";

export type CleanerEarningsDisplay = {
  earningsCents: number | null;
  earningsLabel: string;
};

export type ResolveCleanerEarningsDisplayInput = {
  currency: string;
  metadata: Json | null | undefined;
  /** Server-only: used for preview computation; never exposed to cleaner clients. */
  price_cents: number;
  cleaner_id: string | null;
  earningLines: { payout_amount_cents: number }[];
  cleanerTenureMonths?: number | null;
};

function asRecord(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function previewCentsFromMetadata(metadata: Json | null | undefined): number | null {
  const record = asRecord(metadata);
  const quote = record.quote;
  if (quote == null || typeof quote !== "object" || Array.isArray(quote)) {
    return null;
  }
  const preview = (quote as Record<string, unknown>).cleanerEarningsPreview;
  if (preview == null || typeof preview !== "object" || Array.isArray(preview)) {
    return null;
  }
  const cents = (preview as Record<string, unknown>).perCleanerAmountCents;
  if (typeof cents === "number" && Number.isFinite(cents) && cents > 0) {
    return Math.round(cents);
  }
  return null;
}

function pricingInputFromMetadata(metadata: Json | null | undefined): PricingInput | null {
  const record = asRecord(metadata);
  const quote = record.quote;
  if (quote != null && typeof quote === "object" && !Array.isArray(quote)) {
    const input = (quote as Record<string, unknown>).input;
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

function computePreviewCents(input: ResolveCleanerEarningsDisplayInput): number | null {
  if (input.cleaner_id) {
    const booking = {
      metadata: input.metadata ?? null,
      price_cents: input.price_cents,
      cleaner_id: input.cleaner_id,
    } as BookingRow;
    const computed = computeEarningsForBooking(booking, {
      cleanerTenureMonths: input.cleanerTenureMonths,
    });
    if ("payoutAmountCents" in computed) {
      return computed.payoutAmountCents;
    }
  }

  const pricingInput = pricingInputFromMetadata(input.metadata);
  if (!pricingInput || !Number.isFinite(input.price_cents) || input.price_cents <= 0) {
    return null;
  }

  const preview = computeCleanerEarningsPreview({
    serviceSlug: pricingInput.serviceSlug as ServiceSlug,
    customerTotalCents: input.price_cents,
    teamSize: pricingInput.teamSize ?? 1,
    cleanerTenureMonths: input.cleanerTenureMonths,
  });

  if ("perCleanerAmountCents" in preview) {
    return preview.perCleanerAmountCents;
  }

  return null;
}

/**
 * Resolves cleaner-safe earnings for dashboard/API display.
 * Never returns customer booking total (price_cents) as the display amount.
 */
export function resolveCleanerEarningsDisplay(
  input: ResolveCleanerEarningsDisplayInput,
): CleanerEarningsDisplay {
  if (input.earningLines.length > 0) {
    const cents = input.earningLines[0]!.payout_amount_cents;
    return {
      earningsCents: cents,
      earningsLabel: formatZar(cents, input.currency),
    };
  }

  const fromMetadata = previewCentsFromMetadata(input.metadata);
  if (fromMetadata != null) {
    return {
      earningsCents: fromMetadata,
      earningsLabel: formatZar(fromMetadata, input.currency),
    };
  }

  const computed = computePreviewCents(input);
  if (computed != null) {
    return {
      earningsCents: computed,
      earningsLabel: formatZar(computed, input.currency),
    };
  }

  return {
    earningsCents: null,
    earningsLabel: EARNINGS_BEING_CALCULATED_LABEL,
  };
}
