import { buildResolvedUserArea } from "./resolveUserArea";

/** Common Cape Town service areas shown in the marketing hero location picker. */
export const HERO_LOCATION_PICKER_AREAS = [
  "Claremont",
  "Wynberg",
  "Rondebosch",
  "Newlands",
  "Kenilworth",
  "Sea Point",
  "Green Point",
  "Observatory",
  "Woodstock",
  "Constantia",
  "Bellville",
  "Durbanville",
  "Table View",
  "Milnerton",
  "Somerset West",
] as const;

export type HeroLocationPickerArea = (typeof HERO_LOCATION_PICKER_AREAS)[number];

export function getHeroLocationPickerDisplayLabel(areaName: string): string {
  return buildResolvedUserArea(areaName).displayLabel;
}

export function filterHeroLocationPickerAreas(query: string): HeroLocationPickerArea[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...HERO_LOCATION_PICKER_AREAS];

  return HERO_LOCATION_PICKER_AREAS.filter((area) => {
    const label = getHeroLocationPickerDisplayLabel(area).toLowerCase();
    return area.toLowerCase().includes(q) || label.includes(q);
  });
}
