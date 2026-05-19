import type { EarningPayoutStatus } from "@/lib/database/types";
import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";
import { toneForPayoutStatus } from "@/features/bookings/server/statusLabels";

/**
 * Fallback label from resolveCleanerEarningsDisplay when no safe amount exists.
 * Keep in sync with EARNINGS_BEING_CALCULATED_LABEL in resolveCleanerEarningsDisplay.ts.
 */
export const EARNINGS_BEING_CALCULATED_SERVER_LABEL = "Earnings being calculated";

export const CLEANER_EARNINGS_CALCULATING_DISPLAY_LABEL = "Calculating pay";

export const CLEANER_EARNINGS_CALCULATING_HELPER =
  "We're calculating this after completion. You'll see the amount once it's confirmed.";

/** One-line trust copy on the cleaner earnings page. */
export const CLEANER_EARNINGS_PAGE_TRUST_LINE =
  "Pending means we're confirming the amount; paid jobs appear here once processed.";

export const CLEANER_EARNINGS_EMPTY = {
  title: "No earnings yet",
  description:
    "Completed jobs show here with payout status. Finish jobs to see amounts and payout progress.",
} as const;

export type CleanerPayPresentation = {
  amountText: string;
  isCalculating: boolean;
  helperText?: string;
};

export function isCleanerEarningsCalculating(
  earningsLabel: string,
  earningsCents?: number | null,
): boolean {
  return (
    earningsCents == null && earningsLabel === EARNINGS_BEING_CALCULATED_SERVER_LABEL
  );
}

/**
 * Maps server earnings labels to cleaner-friendly pay copy (never invents amounts).
 */
export function presentCleanerPayLine(
  earningsLabel: string,
  earningsCents?: number | null,
  options?: { includeCalculatingHelper?: boolean },
): CleanerPayPresentation {
  if (isCleanerEarningsCalculating(earningsLabel, earningsCents)) {
    return {
      amountText: CLEANER_EARNINGS_CALCULATING_DISPLAY_LABEL,
      isCalculating: true,
      helperText: options?.includeCalculatingHelper
        ? CLEANER_EARNINGS_CALCULATING_HELPER
        : undefined,
    };
  }

  return {
    amountText: earningsLabel,
    isCalculating: false,
  };
}

/** Cleaner-facing payout status labels (calm; no internal ops wording). */
export function labelForCleanerPayoutStatus(status: EarningPayoutStatus): string {
  const labels: Record<EarningPayoutStatus, string> = {
    pending: "Pending payout",
    payout_ready: "Ready for payout",
    paid: "Paid",
  };
  return labels[status];
}

export function toneForCleanerPayoutStatus(status: EarningPayoutStatus): StatusBadgeTone {
  return toneForPayoutStatus(status);
}

/** Optional one-line context under payout chips on earnings surfaces. */
export function cleanerPayoutStatusHelper(status: EarningPayoutStatus): string | undefined {
  switch (status) {
    case "pending":
      return "Being reviewed after the job.";
    case "payout_ready":
      return "Queued for the next payout run.";
    case "paid":
      return undefined;
    default:
      return undefined;
  }
}
