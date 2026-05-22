import type { CleanerAreaOption, CleanerAreaOptionGroup } from "./locationRegistry";
import {
  findLocationByNameOrAlias,
  normalizeLocationName,
} from "./locationRegistry";

export function locationOptionMatchesQuery(
  option: CleanerAreaOption,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (option.label.toLowerCase().includes(q)) return true;
  if (option.slug.toLowerCase().includes(q)) return true;
  if (option.region.toLowerCase().includes(q)) return true;

  const canonical = normalizeLocationName(query).toLowerCase();
  if (canonical && option.label.toLowerCase().includes(canonical)) return true;

  const resolved = findLocationByNameOrAlias(query);
  if (resolved?.slug === option.slug) return true;

  const entry = findLocationByNameOrAlias(option.label);
  if (entry?.aliases.some((alias) => alias.toLowerCase().includes(q))) return true;

  return false;
}

export function filterCleanerAreaOptionGroups(
  groups: CleanerAreaOptionGroup[],
  query: string,
): CleanerAreaOptionGroup[] {
  const q = query.trim();
  if (!q) return groups;

  return groups
    .map((group) => ({
      ...group,
      options: group.options.filter((opt) => locationOptionMatchesQuery(opt, q)),
    }))
    .filter((group) => group.options.length > 0);
}
