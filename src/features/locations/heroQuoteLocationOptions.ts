import { applyManualUserArea } from "./detectUserArea";
import { getHeroLocationPickerDisplayLabel } from "./heroLocationPickerAreas";
import {
  FALLBACK_USER_AREA_LABEL,
  getCachedUserArea,
  setCachedUserArea,
} from "./resolveUserArea";

/** Cape Town suburbs for the Instant Quote location dropdown (display order). */
export const HERO_QUOTE_LOCATION_AREAS = [
  "Claremont",
  "Wynberg",
  "Rondebosch",
  "Newlands",
  "Kenilworth",
  "Sea Point",
  "Green Point",
  "Camps Bay",
  "Bellville",
  "Durbanville",
  "Table View",
  "Milnerton",
  "Woodstock",
  "Observatory",
  "Constantia",
  "Somerset West",
] as const;

export const HERO_QUOTE_OTHER_LOCATION_LABEL = "Other Cape Town area" as const;

export type HeroQuoteLocationOption = {
  value: string;
  label: string;
  areaName: string | null;
};

export function buildHeroQuoteLocationOptions(): HeroQuoteLocationOption[] {
  const suburbs: HeroQuoteLocationOption[] = HERO_QUOTE_LOCATION_AREAS.map((area) => {
    const label = getHeroLocationPickerDisplayLabel(area);
    return { value: label, label, areaName: area };
  });

  return [
    ...suburbs,
    {
      value: HERO_QUOTE_OTHER_LOCATION_LABEL,
      label: HERO_QUOTE_OTHER_LOCATION_LABEL,
      areaName: null,
    },
  ];
}

export function filterHeroQuoteLocationOptions(
  options: readonly HeroQuoteLocationOption[],
  query: string,
): HeroQuoteLocationOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];

  return options.filter((option) => {
    const label = option.label.toLowerCase();
    const suburb = option.areaName?.toLowerCase() ?? "";

    if (suburb.includes(q) || label.includes(q)) {
      return true;
    }

    if (option.areaName === null) {
      return q.includes("other") || q.includes("cape") || label.includes(q);
    }

    return false;
  });
}

export function persistQuoteLocationSelection(option: HeroQuoteLocationOption): void {
  if (option.areaName) {
    applyManualUserArea(option.areaName);
    return;
  }

  setCachedUserArea({
    areaName: "Cape Town",
    displayLabel: HERO_QUOTE_OTHER_LOCATION_LABEL,
  });
}

/** Resolve dropdown value from cached hero location when present. */
export function resolveInitialQuoteLocationValue(
  options: readonly HeroQuoteLocationOption[] = buildHeroQuoteLocationOptions(),
): string {
  const cached = getCachedUserArea();
  const fallback = options[0]?.value ?? HERO_QUOTE_OTHER_LOCATION_LABEL;

  if (!cached) return fallback;

  if (cached.displayLabel === FALLBACK_USER_AREA_LABEL) {
    return HERO_QUOTE_OTHER_LOCATION_LABEL;
  }

  const byLabel = options.find(
    (option) => option.label === cached.displayLabel || option.value === cached.displayLabel,
  );
  if (byLabel) return byLabel.value;

  const byArea = options.find((option) => option.areaName === cached.areaName);
  if (byArea) return byArea.value;

  return cached.displayLabel || fallback;
}
