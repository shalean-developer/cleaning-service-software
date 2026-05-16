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
