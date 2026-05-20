import type { AddonSlug } from "@/features/pricing/server/types";
import type { BookingWizardState } from "./types";

/** Wizard fields that affect calculateQuote or lock pricingInput / schedule. */
const QUOTE_INVALIDATING_KEYS = [
  "serviceSlug",
  "date",
  "time",
  "frequency",
  "bedrooms",
  "bathrooms",
  "extraRooms",
  "propertySizeSqm",
  "officeSizeTier",
  "officeWorkstations",
  "cleaningIntensity",
  "equipmentSupply",
  "requestedTeamSize",
  "addons",
] as const satisfies readonly (keyof BookingWizardState)[];

export const CHECKOUT_QUOTE_REQUIRED_MESSAGE =
  "Please review your booking and confirm the updated price before paying.";

function addonsChanged(prev: AddonSlug[], next: AddonSlug[]): boolean {
  if (prev.length !== next.length) return true;
  const prevSet = new Set(prev);
  return next.some((slug) => !prevSet.has(slug));
}

function isQuoteInvalidatingChange(
  prev: BookingWizardState,
  partial: Partial<BookingWizardState>,
): boolean {
  for (const key of QUOTE_INVALIDATING_KEYS) {
    if (!(key in partial)) continue;
    const nextValue = partial[key];
    if (nextValue === undefined) continue;

    if (key === "addons") {
      if (addonsChanged(prev.addons, partial.addons ?? prev.addons)) return true;
      continue;
    }

    if (prev[key] !== nextValue) return true;
  }

  return false;
}

/** Clears cached quote and review confirmation when pricing or lock-schedule inputs change. */
export function mergeWithQuoteInvalidation(
  prev: BookingWizardState,
  partial: Partial<BookingWizardState>,
): Partial<BookingWizardState> {
  if (!isQuoteInvalidatingChange(prev, partial)) return partial;
  return {
    ...partial,
    quote: null,
    reviewConfirmed: false,
  };
}

export function applyWizardStatePatch(
  prev: BookingWizardState,
  partial: Partial<BookingWizardState>,
): BookingWizardState {
  return { ...prev, ...mergeWithQuoteInvalidation(prev, partial) };
}

export function shouldRedirectCheckoutWithoutQuote(
  state: Pick<BookingWizardState, "step" | "quote">,
): boolean {
  return state.step === "checkout" && state.quote == null;
}
