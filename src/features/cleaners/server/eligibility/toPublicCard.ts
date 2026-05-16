import type {
  CleanerCandidateRecord,
  CleanerPublicCard,
  EligibilityEvaluation,
} from "../types";
import { eligibilityCodeToStatus } from "./evaluate";
import { summarizeAvailability, summarizeServiceAreas } from "./slot";

const FORBIDDEN_CARD_KEYS = [
  "phone",
  "profileId",
  "profile_id",
  "email",
  "address",
  "suspendedAt",
  "hiredAt",
] as const;

export function toCleanerPublicCard(
  candidate: CleanerCandidateRecord,
  evaluation: EligibilityEvaluation,
  estimatedEarningsPreviewCents?: number,
): CleanerPublicCard {
  const card: CleanerPublicCard = {
    cleanerId: candidate.cleanerId,
    displayName: candidate.displayName,
    rating: candidate.averageRating,
    serviceAreasSummary: summarizeServiceAreas(candidate.serviceAreas),
    availabilitySummary: summarizeAvailability(candidate.availabilityWindows),
    eligibilityStatus: eligibilityCodeToStatus(evaluation),
    eligibilityReason: evaluation.message,
    eligibilityCode: evaluation.code,
  };

  if (
    estimatedEarningsPreviewCents != null &&
    Number.isFinite(estimatedEarningsPreviewCents) &&
    estimatedEarningsPreviewCents > 0
  ) {
    card.estimatedEarningsPreviewCents = estimatedEarningsPreviewCents;
  }

  return card;
}

/** Ensures serialized API payloads never include private cleaner fields. */
export function assertPublicCleanerCard(card: Record<string, unknown>): void {
  for (const key of FORBIDDEN_CARD_KEYS) {
    if (key in card) {
      throw new Error(`Public cleaner card must not include private field: ${key}`);
    }
  }
}

export function serializePublicCleanerCards(cards: CleanerPublicCard[]): CleanerPublicCard[] {
  for (const card of cards) {
    assertPublicCleanerCard(card as unknown as Record<string, unknown>);
  }
  return cards;
}
