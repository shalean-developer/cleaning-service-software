import "server-only";

/**
 * NF-7D: Team slot offers and roster sync. Disabled by default. single-cleaner dispatch unchanged.
 * Set TEAM_OFFERS_ENABLED=true to allow primary+support open offers and roster wiring.
 */
export function isTeamOffersEnabled(): boolean {
  const raw = process.env.TEAM_OFFERS_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}
