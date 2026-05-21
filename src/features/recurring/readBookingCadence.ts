import { PRICING_FREQUENCIES, type PricingFrequency } from "@/features/pricing/server/types";
import type { Json } from "@/lib/database/types";
import {
  isRecurringSeriesFrequency,
  pricingFrequencyToSeriesFrequency,
  type RecurringSeriesFrequency,
} from "./types";

export function readBookingFrequencyFromMetadata(metadata: Json): PricingFrequency {
  const record =
    metadata != null && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const quote =
    record.quote != null && typeof record.quote === "object" && !Array.isArray(record.quote)
      ? (record.quote as Record<string, unknown>)
      : null;
  const quoteInput =
    quote?.input != null && typeof quote.input === "object" && !Array.isArray(quote.input)
      ? (quote.input as Record<string, unknown>)
      : null;
  const raw =
    (typeof record.frequency === "string" ? record.frequency : null) ??
    (typeof quote?.frequency === "string" ? quote.frequency : null) ??
    (typeof quoteInput?.frequency === "string" ? quoteInput.frequency : null);
  if (raw && (PRICING_FREQUENCIES as readonly string[]).includes(raw)) {
    return raw as PricingFrequency;
  }
  return "once";
}

export function readSeriesFrequencyFromBookingMetadata(
  metadata: Json,
): RecurringSeriesFrequency | null {
  const frequency = readBookingFrequencyFromMetadata(metadata);
  return pricingFrequencyToSeriesFrequency(frequency);
}

export function readServiceSlugFromBookingMetadata(metadata: Json): string | null {
  const record =
    metadata != null && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const quote = record.quote;
  if (quote != null && typeof quote === "object" && !Array.isArray(quote)) {
    const input = (quote as Record<string, unknown>).input;
    if (input != null && typeof input === "object" && !Array.isArray(input)) {
      const slug = (input as Record<string, unknown>).serviceSlug;
      if (typeof slug === "string" && slug.trim()) return slug.trim();
    }
  }
  const top = record.serviceSlug ?? record.service_slug;
  return typeof top === "string" && top.trim() ? top.trim() : null;
}

export function isOnceOffCadence(frequency: PricingFrequency): boolean {
  return frequency === "once";
}

export function assertRecurringSeriesFrequency(
  value: string,
): RecurringSeriesFrequency | null {
  return isRecurringSeriesFrequency(value) ? value : null;
}
