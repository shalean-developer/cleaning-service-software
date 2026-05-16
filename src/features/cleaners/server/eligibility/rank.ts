import type { BestAvailableRecommendation, CleanerPublicCard } from "../types";

/**
 * Deterministic best-available pick for auto-assign path (Phase 8 will reuse).
 * Sort: higher rating first, then lower cleanerId (UUID) for stable tie-break.
 */
export function pickBestAvailable(
  eligible: CleanerPublicCard[],
): BestAvailableRecommendation | null {
  if (eligible.length === 0) return null;

  const sorted = [...eligible].sort((a, b) => {
    const ratingA = a.rating ?? 0;
    const ratingB = b.rating ?? 0;
    if (ratingB !== ratingA) return ratingB - ratingA;
    return a.cleanerId.localeCompare(b.cleanerId);
  });

  const top = sorted[0]!;
  const rankScore = Math.round((top.rating ?? 0) * 100);

  return {
    cleanerId: top.cleanerId,
    displayName: top.displayName,
    rankScore,
    reason: `Highest rating (${top.rating ?? "n/a"}) with stable id tie-break.`,
  };
}
