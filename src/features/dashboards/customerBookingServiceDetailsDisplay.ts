import { formatBedroomBathroomSummary, formatSelectedAddons, getFrequencyLabel } from "@/features/booking-wizard/reviewDisplay";
import type { AddonSlug, PricingFrequency } from "@/features/pricing/server/types";
import { isServiceSlug } from "@/features/pricing/server/catalog";
import type { Json } from "@/lib/database/types";

export type CustomerBookingServiceDetails = {
  homeSizeSummary: string | null;
  frequencyLabel: string | null;
  addonsSummary: string | null;
};

function asRecord(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  return metadata as Record<string, unknown>;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readFrequency(value: unknown): PricingFrequency | null {
  if (
    value === "once" ||
    value === "weekly" ||
    value === "biweekly" ||
    value === "monthly"
  ) {
    return value;
  }
  return null;
}

function readAddons(value: unknown): AddonSlug[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AddonSlug => typeof item === "string");
}

function resolveInputRecord(record: Record<string, unknown>): Record<string, unknown> {
  const quote = record.quote;
  if (quote != null && typeof quote === "object" && !Array.isArray(quote)) {
    const quoteRecord = quote as Record<string, unknown>;
    const input = quoteRecord.input;
    if (input != null && typeof input === "object" && !Array.isArray(input)) {
      return { ...record, ...(input as Record<string, unknown>) };
    }
  }
  return record;
}

/** Display-only service details from booking metadata (no lifecycle logic). */
export function parseCustomerBookingServiceDetails(
  metadata: Json | null | undefined,
  serviceSlug: string | null,
): CustomerBookingServiceDetails {
  const merged = resolveInputRecord(asRecord(metadata));
  const slug = serviceSlug && isServiceSlug(serviceSlug) ? serviceSlug : null;

  const bedrooms = readNumber(merged.bedrooms);
  const bathrooms = readNumber(merged.bathrooms);
  const propertySizeSqm = readNumber(merged.propertySizeSqm);
  const frequency = readFrequency(merged.frequency);
  const addons = readAddons(merged.addons);

  let homeSizeSummary: string | null = null;
  if (bedrooms != null && bathrooms != null) {
    const { bedroomsLabel, bathroomsLabel } = formatBedroomBathroomSummary(
      slug,
      bedrooms,
      bathrooms,
      propertySizeSqm,
    );
    const parts = [bedroomsLabel, bathroomsLabel].filter(Boolean);
    homeSizeSummary = parts.length > 0 ? parts.join(" · ") : null;
  }

  return {
    homeSizeSummary,
    frequencyLabel: frequency ? getFrequencyLabel(frequency) : null,
    addonsSummary: addons.length > 0 ? formatSelectedAddons(addons) : null,
  };
}
