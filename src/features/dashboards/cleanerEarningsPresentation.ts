import type { CleanerEarningListItem } from "@/features/earnings/server/types";
import type { EarningPayoutStatus } from "@/lib/database/types";
import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";
import { toneForPayoutStatus } from "@/features/bookings/server/statusLabels";

/** Helper under the completed-jobs summary on the earnings page. */
export const CLEANER_EARNINGS_SUMMARY_COMPLETED_JOBS_HELPER =
  "Completed cleaning services";

/** Helper under the total-earnings summary on the earnings page. */
export const CLEANER_EARNINGS_SUMMARY_TOTAL_EARNINGS_HELPER = "Across completed payouts";

export type CleanerEarningsPageSummary = {
  completedJobCount: number;
  totalEarningsCents: number;
};

/**
 * Display-only rollup from the same earning lines shown in the list (no payout math changes).
 */
export function summarizeCleanerEarningsForDisplay(
  earnings: CleanerEarningListItem[],
): CleanerEarningsPageSummary {
  const completedJobKeys = new Set<string>();
  let totalEarningsCents = 0;

  for (const line of earnings) {
    totalEarningsCents += line.payoutAmountCents;
    completedJobKeys.add(line.bookingId ?? line.id);
  }

  return {
    completedJobCount: completedJobKeys.size,
    totalEarningsCents,
  };
}

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
