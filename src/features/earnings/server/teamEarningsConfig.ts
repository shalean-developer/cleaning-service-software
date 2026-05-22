import "server-only";

/**
 * NF-7G: Multi-cleaner earning lines and split foundation.
 * Disabled by default. legacy lead-only earning behavior remains.
 * Set TEAM_EARNINGS_ENABLED=true (requires TEAM_OFFERS_ENABLED for roster data).
 */
export function isTeamEarningsEnabled(): boolean {
  const raw = process.env.TEAM_EARNINGS_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}
