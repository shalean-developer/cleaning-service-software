import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import type { PricingInput } from "@/features/pricing/server/types";
import type {
  AvailableCleanersResult,
  BookingCleanersResult,
  CleanerCandidateRecord,
  CleanerPublicCard,
  EligibilityQuery,
  SelectedCleanerCheck,
} from "../types";
import { evaluateCleanerEligibility } from "./evaluate";
import { pickBestAvailable } from "./rank";
import { parseBookingSlot } from "./slot";
import { serializePublicCleanerCards, toCleanerPublicCard } from "./toPublicCard";

export type ListEligibleCleanersParams = {
  candidates: CleanerCandidateRecord[];
  query: EligibilityQuery;
  conflictingCleanerIds: ReadonlySet<string>;
  pricingInput?: PricingInput | null;
  selectedCleanerId?: string | null;
};

function monthsBetween(startIso: string, now: Date): number {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return 0;
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  return Math.max(0, months);
}

function earningsPreviewForCleaner(
  pricingInput: PricingInput | null | undefined,
  hiredAt: string,
): number | undefined {
  if (!pricingInput) return undefined;

  const quote = calculateQuote({
    ...pricingInput,
    cleanerTenureMonths: monthsBetween(hiredAt, new Date()),
  });

  if (!quote.ok) return undefined;
  return quote.breakdown.cleanerEarnings.perCleanerAmountCents;
}

export function listEligibleCleaners(
  params: ListEligibleCleanersParams,
): AvailableCleanersResult | { ok: false; code: string; message: string } {
  const parsedSlot = parseBookingSlot(params.query.slot);
  if (!parsedSlot) {
    return {
      ok: false,
      code: "INVALID_SLOT",
      message: "scheduledStart and scheduledEnd must be valid ISO datetimes.",
    };
  }

  const cards: CleanerPublicCard[] = [];

  for (const candidate of params.candidates) {
    const evaluation = evaluateCleanerEligibility(
      candidate,
      params.query,
      parsedSlot,
      params.conflictingCleanerIds,
    );

    const earnings = evaluation.eligible
      ? earningsPreviewForCleaner(params.pricingInput, candidate.hiredAt)
      : undefined;

    cards.push(toCleanerPublicCard(candidate, evaluation, earnings));
  }

  const eligibleOnly = cards.filter((c) => c.eligibilityStatus === "eligible");
  const bestAvailable = pickBestAvailable(eligibleOnly);

  return {
    cleaners: serializePublicCleanerCards(cards),
    bestAvailable,
  };
}

export function listBookingCleaners(
  params: ListEligibleCleanersParams,
): BookingCleanersResult | { ok: false; code: string; message: string } {
  const base = listEligibleCleaners(params);
  if ("ok" in base && base.ok === false) return base;

  const result = base as AvailableCleanersResult;
  let selectedCleaner: SelectedCleanerCheck | null = null;

  if (params.selectedCleanerId) {
    const card = result.cleaners.find((c) => c.cleanerId === params.selectedCleanerId);
    if (card) {
      selectedCleaner = {
        cleanerId: card.cleanerId,
        eligible: card.eligibilityStatus === "eligible",
        eligibilityStatus: card.eligibilityStatus,
        eligibilityReason: card.eligibilityReason,
        eligibilityCode: card.eligibilityCode,
      };
    } else {
      selectedCleaner = {
        cleanerId: params.selectedCleanerId,
        eligible: false,
        eligibilityStatus: "ineligible",
        eligibilityReason: "Selected cleaner was not found.",
        eligibilityCode: null,
      };
    }
  }

  return {
    ...result,
    selectedCleaner,
  };
}
