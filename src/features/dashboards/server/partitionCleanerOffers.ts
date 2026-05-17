import type { CleanerOfferListItem } from "./types";

export function canRespondToCleanerOffer(offer: CleanerOfferListItem): boolean {
  return offer.status === "offered" && !offer.isExpired;
}

export function partitionCleanerOffers(offers: CleanerOfferListItem[]): {
  needsResponse: CleanerOfferListItem[];
  pastOffers: CleanerOfferListItem[];
} {
  const needsResponse = offers
    .filter(canRespondToCleanerOffer)
    .sort((a, b) => compareExpiresAtAsc(a.expiresAt, b.expiresAt));

  const pastOffers = offers
    .filter((offer) => !canRespondToCleanerOffer(offer))
    .sort((a, b) => b.offeredAt.localeCompare(a.offeredAt));

  return { needsResponse, pastOffers };
}

function compareExpiresAtAsc(
  a: string | null,
  b: string | null,
): number {
  const aMs = a ? new Date(a).getTime() : Number.MAX_SAFE_INTEGER;
  const bMs = b ? new Date(b).getTime() : Number.MAX_SAFE_INTEGER;
  return aMs - bMs;
}
