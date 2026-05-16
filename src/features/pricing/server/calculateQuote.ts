import { computeCleanerEarningsPreview } from "./computeCleanerEarnings";
import {
  buildAddonLineItems,
  buildFrequencyLineItem,
  buildServiceLineItems,
  sumLineItems,
} from "./computeLineItems";
import type {
  CleanerEarningsPreview,
  PricingBreakdown,
  PricingInput,
  PricingLineItem,
  PricingQuoteFailure,
  PricingQuoteResult,
} from "./types";
import { PRICING_CURRENCY, PRICING_VERSION } from "./types";
import { validatePricingInput } from "./validateInput";

function fail(
  code: Extract<PricingQuoteResult, { ok: false }>["code"],
  message: string,
): PricingQuoteResult {
  return { ok: false, code, message };
}

function assertNonNegativeLineItems(
  lineItems: PricingLineItem[],
): PricingQuoteResult | null {
  for (const item of lineItems) {
    if (!Number.isFinite(item.amountCents)) {
      return fail("NEGATIVE_AMOUNT", "A line item has a non-finite amount.");
    }
    if (item.code !== "frequency_discount" && item.amountCents < 0) {
      return fail("NEGATIVE_AMOUNT", "Line item amounts cannot be negative.");
    }
  }
  return null;
}

/**
 * Deterministic quote for Shalean Cleaning Services (ZAR).
 * Returns customer total, transparent line items, and cleaner earnings preview.
 */
export function calculateQuote(input: PricingInput): PricingQuoteResult {
  const validationError = validatePricingInput(input);
  if (validationError) return validationError;

  const frequency = input.frequency ?? "once";
  const teamSize = input.teamSize ?? 1;

  const serviceItems = buildServiceLineItems(input);
  const addonItems = buildAddonLineItems(input.addons);
  const preDiscountItems = [...serviceItems, ...addonItems];

  const lineError = assertNonNegativeLineItems(preDiscountItems);
  if (lineError) return lineError;

  const subtotalCents = sumLineItems(preDiscountItems);
  if (subtotalCents <= 0) {
    return fail("ZERO_TOTAL", "Quote subtotal must be greater than zero.");
  }

  const frequencyItem = buildFrequencyLineItem(subtotalCents, frequency);
  const lineItems = frequencyItem
    ? [...preDiscountItems, frequencyItem]
    : [...preDiscountItems];

  const totalCents = sumLineItems(lineItems);
  const discountCents = frequencyItem ? Math.abs(frequencyItem.amountCents) : 0;

  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    return fail("ZERO_TOTAL", "Customer total must be greater than zero.");
  }

  if (totalCents > 100_000_000) {
    return fail("UNSAFE_TOTAL", "Customer total exceeds the allowed maximum.");
  }

  const earnings = computeCleanerEarningsPreview({
    serviceSlug: input.serviceSlug,
    customerTotalCents: totalCents,
    teamSize,
    cleanerTenureMonths: input.cleanerTenureMonths,
  });

  if (isPricingFailure(earnings)) {
    return earnings;
  }

  const cleanerEarnings: CleanerEarningsPreview = earnings;

  const breakdown: PricingBreakdown = {
    pricingVersion: PRICING_VERSION,
    currency: PRICING_CURRENCY,
    serviceSlug: input.serviceSlug,
    lineItems,
    subtotalCents,
    discountCents,
    totalCents,
    frequency,
    cleanerEarnings,
    metadata: {
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      propertySizeSqm: input.propertySizeSqm ?? null,
      teamSize,
      addons: input.addons ?? [],
    },
  };

  return { ok: true, breakdown };
}

function isPricingFailure(
  value: CleanerEarningsPreview | PricingQuoteFailure,
): value is PricingQuoteFailure {
  return "ok" in value && value.ok === false;
}
