import {
  findLocationByNameOrAlias,
  findLocationBySlug,
  normalizeLocationName,
  type LocationRegistryEntry,
} from "./locationRegistry";

/** Human-readable name for a slug, registry name, alias, or legacy free-text value. */
export function formatLocationName(slugOrName: string): string {
  const trimmed = slugOrName.trim();
  if (!trimmed) return "";

  const bySlug = findLocationBySlug(trimmed);
  if (bySlug) return bySlug.name;

  const byAlias = findLocationByNameOrAlias(trimmed);
  if (byAlias) return byAlias.name;

  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/i.test(trimmed)) {
    return trimmed
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(" ");
  }

  return normalizeLocationName(trimmed);
}

/** Resolve input to a registry entry when it matches slug, name, or alias. */
export function resolveOperationalLocation(input: string): LocationRegistryEntry | undefined {
  return findLocationByNameOrAlias(input);
}

export function isKnownOperationalArea(input: string): boolean {
  return Boolean(findLocationByNameOrAlias(input));
}

/** Canonical display name when known; otherwise normalized free text. */
export function normalizeLocationInput(input: string): string {
  const match = findLocationByNameOrAlias(input);
  if (match) return match.name;
  return normalizeLocationName(input);
}

/** Comma-separated human-readable service areas (slugs or legacy strings). */
export function formatServiceAreaList(slugs: string[]): string {
  if (slugs.length === 0) return "All service areas";
  const names = slugs.map((slug) => formatLocationName(slug)).filter(Boolean);
  if (names.length === 0) return "All service areas";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;
}

/** Extra search tokens for admin filters (canonical name + aliases). */
export function locationSearchTokens(input: string | null | undefined): string[] {
  const trimmed = input?.trim();
  if (!trimmed) return [];
  const tokens = new Set<string>([trimmed.toLowerCase()]);
  const entry = findLocationByNameOrAlias(trimmed);
  if (entry) {
    tokens.add(entry.name.toLowerCase());
    tokens.add(entry.slug.toLowerCase());
    for (const alias of entry.aliases) {
      tokens.add(alias.toLowerCase());
    }
  }
  return [...tokens];
}
