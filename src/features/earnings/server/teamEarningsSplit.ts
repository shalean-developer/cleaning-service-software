import "server-only";

import type { BookingCleanerRow } from "@/lib/database/types";

/** MVP split policy: equal shares among expected team participants. */
export const TEAM_EARNINGS_SPLIT_POLICY = "equal" as const;

export type TeamEarningRole = "primary" | "support";
export type TeamEarningSource = "team_split" | "manual_adjustment" | "legacy_primary";

export const PRIMARY_COMPLETION_LINE_TYPE = "booking_completion";
export const SUPPORT_COMPLETION_LINE_TYPE = "team_support_completion";

const ACTIVE_SUPPORT_STATUSES = new Set<BookingCleanerRow["status"]>(["accepted", "completed"]);

export function rosterAcceptedSupportRows(
  roster: BookingCleanerRow[],
): BookingCleanerRow[] {
  return roster.filter((r) => r.role === "support" && ACTIVE_SUPPORT_STATUSES.has(r.status));
}

export function rosterConfirmedSupportRows(
  roster: BookingCleanerRow[],
): BookingCleanerRow[] {
  return roster.filter((r) => r.role === "support" && r.status === "completed");
}

/**
 * Equal split divisor for team jobs: 1 (lead) + accepted support slots.
 * Support earning lines are only created after participation confirmation.
 */
export function equalSplitParticipantCount(roster: BookingCleanerRow[]): number {
  const acceptedSupport = rosterAcceptedSupportRows(roster);
  return 1 + acceptedSupport.length;
}

export function computeEqualShareCents(
  totalPoolCents: number,
  participantCount: number,
): number {
  if (participantCount < 1 || totalPoolCents <= 0) return 0;
  return Math.floor(totalPoolCents / participantCount);
}

export type PrimaryCompletionSplit = {
  payoutAmountCents: number;
  teamEarningRole: TeamEarningRole;
  teamEarningSource: TeamEarningSource;
  participantCount: number;
  totalPoolCents: number;
  splitPolicy: typeof TEAM_EARNINGS_SPLIT_POLICY;
};

/**
 * Primary line at booking completion.
 * - No accepted support → full pool (legacy_primary).
 * - Accepted support on roster → equal share reserved per MVP policy.
 */
export function computePrimaryCompletionSplit(
  totalPoolCents: number,
  roster: BookingCleanerRow[],
  teamEarningsEnabled: boolean,
): PrimaryCompletionSplit {
  const acceptedSupport = rosterAcceptedSupportRows(roster);
  const participantCount =
    teamEarningsEnabled && acceptedSupport.length > 0
      ? equalSplitParticipantCount(roster)
      : 1;

  const payoutAmountCents = computeEqualShareCents(totalPoolCents, participantCount);
  const teamEarningSource: TeamEarningSource =
    participantCount > 1 ? "team_split" : "legacy_primary";

  return {
    payoutAmountCents,
    teamEarningRole: "primary",
    teamEarningSource,
    participantCount,
    totalPoolCents,
    splitPolicy: TEAM_EARNINGS_SPLIT_POLICY,
  };
}

export function computeSupportCompletionSplit(
  totalPoolCents: number,
  roster: BookingCleanerRow[],
): {
  payoutAmountCents: number;
  participantCount: number;
} {
  const participantCount = equalSplitParticipantCount(roster);
  return {
    payoutAmountCents: computeEqualShareCents(totalPoolCents, participantCount),
    participantCount,
  };
}
