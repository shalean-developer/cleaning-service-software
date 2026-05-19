import type { AddonSlug } from "@/features/pricing/server/types";
import type { BookingWizardState } from "./types";

const QUOTE_INVALIDATING_KEYS = [
  "frequency",
  "bedrooms",
  "bathrooms",
  "extraRooms",
  "addons",
  "cleaningIntensity",
] as const satisfies readonly (keyof BookingWizardState)[];

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

/** Clears cached quote and review confirmation when pricing inputs change. */
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
