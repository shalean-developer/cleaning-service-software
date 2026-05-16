import { ASSIGNMENT_OFFER_TTL_HOURS } from "./constants";

export function buildOfferExpiresAt(from: Date = new Date()): string {
  return new Date(from.getTime() + ASSIGNMENT_OFFER_TTL_HOURS * 60 * 60 * 1000).toISOString();
}

export function isOfferPastExpiry(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now.getTime();
}

/** True when an offer row is still actionable (offered and not past expires_at). */
export function isOfferOpenForOps(
  offer: { status: string; expires_at: string | null },
  now: Date = new Date(),
): boolean {
  if (offer.status !== "offered") return false;
  return !isOfferPastExpiry(offer.expires_at, now);
}
