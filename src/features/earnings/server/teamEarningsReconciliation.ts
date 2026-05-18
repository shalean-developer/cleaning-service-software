import "server-only";

import type { BookingCleanerRow, BookingRow, EarningLineRow } from "@/lib/database/types";
import { isTeamEarningsEnabled } from "./teamEarningsConfig";
import { resolveTeamEarningsPool } from "./teamEarningsPool";
import {
  PRIMARY_COMPLETION_LINE_TYPE,
  SUPPORT_COMPLETION_LINE_TYPE,
  computeEqualShareCents,
  equalSplitParticipantCount,
  rosterAcceptedSupportRows,
  rosterConfirmedSupportRows,
} from "./teamEarningsSplit";

export type TeamEarningsReconciliationSeverity = "info" | "warning" | "error";

export type TeamEarningsReconciliationIssue = {
  code: string;
  severity: TeamEarningsReconciliationSeverity;
  message: string;
};

export const PAYOUT_READY_BLOCKING_ISSUE_CODES = new Set([
  "PAYOUT_EXCEEDS_POOL",
  "MISSING_SUPPORT_EARNING_LINE",
  "PRIMARY_SPLIT_MISMATCH",
  "SUPPORT_SPLIT_MISMATCH",
  "DUPLICATE_CLEANER_COMPLETION_LINES",
  "ORPHAN_SUPPORT_EARNING_LINE",
]);

export type TeamEarningsReconciliationStatus =
  | "disabled"
  | "ok"
  | "blocked"
  | "warnings";

export type TeamEarningsReconciliationReport = {
  enabled: boolean;
  splitPolicy: "equal" | null;
  expectedParticipantCount: number;
  expectedShareCents: number | null;
  totalPoolCents: number | null;
  recordedPayoutCents: number;
  status: TeamEarningsReconciliationStatus;
  canMarkPayoutReady: boolean;
  blockingIssues: TeamEarningsReconciliationIssue[];
  warnings: TeamEarningsReconciliationIssue[];
  issues: TeamEarningsReconciliationIssue[];
};

export function partitionReconciliationIssues(issues: TeamEarningsReconciliationIssue[]): {
  blockingIssues: TeamEarningsReconciliationIssue[];
  warnings: TeamEarningsReconciliationIssue[];
} {
  const blockingIssues: TeamEarningsReconciliationIssue[] = [];
  const warnings: TeamEarningsReconciliationIssue[] = [];
  for (const issue of issues) {
    if (PAYOUT_READY_BLOCKING_ISSUE_CODES.has(issue.code)) {
      blockingIssues.push({ ...issue, severity: "error" });
    } else {
      warnings.push(issue);
    }
  }
  return { blockingIssues, warnings };
}

export function deriveReconciliationStatus(
  enabled: boolean,
  blockingIssues: TeamEarningsReconciliationIssue[],
  warnings: TeamEarningsReconciliationIssue[],
): TeamEarningsReconciliationStatus {
  if (!enabled) return "disabled";
  if (blockingIssues.length > 0) return "blocked";
  if (warnings.length > 0) return "warnings";
  return "ok";
}

export function hasPayoutReadyBlockingIssues(
  report: TeamEarningsReconciliationReport,
): boolean {
  return report.enabled && report.blockingIssues.length > 0;
}

export function reconcileTeamEarningsForBooking(params: {
  booking: BookingRow;
  roster: BookingCleanerRow[];
  earningLines: EarningLineRow[];
}): TeamEarningsReconciliationReport {
  const { booking, roster, earningLines } = params;
  const enabled = isTeamEarningsEnabled();
  const issues: TeamEarningsReconciliationIssue[] = [];

  const completionLines = earningLines.filter(
    (l) =>
      l.line_type === PRIMARY_COMPLETION_LINE_TYPE ||
      l.line_type === SUPPORT_COMPLETION_LINE_TYPE,
  );
  const recordedPayoutCents = completionLines.reduce(
    (sum, l) => sum + l.payout_amount_cents,
    0,
  );

  const acceptedSupport = rosterAcceptedSupportRows(roster);
  const confirmedSupport = rosterConfirmedSupportRows(roster);
  const expectedParticipantCount =
    enabled && acceptedSupport.length > 0 ? equalSplitParticipantCount(roster) : 1;

  let totalPoolCents: number | null = null;
  let expectedShareCents: number | null = null;

  if (!enabled) {
    const { blockingIssues, warnings } = partitionReconciliationIssues(issues);
    return {
      enabled: false,
      splitPolicy: null,
      expectedParticipantCount: 1,
      expectedShareCents: null,
      totalPoolCents: null,
      recordedPayoutCents,
      status: "disabled",
      canMarkPayoutReady: true,
      blockingIssues,
      warnings,
      issues,
    };
  }

  const pool = resolveTeamEarningsPool(booking);
  if (pool.ok) {
    totalPoolCents = pool.totalPoolCents;
    expectedShareCents = computeEqualShareCents(totalPoolCents, expectedParticipantCount);
  }

  if (acceptedSupport.length > 0 && completionLines.length === 0) {
    issues.push({
      code: "MISSING_EARNING_LINES",
      severity: "warning",
      message: "Team roster has accepted support but no completion earning lines yet.",
    });
  }

  for (const support of acceptedSupport) {
    const hasLine = completionLines.some(
      (l) =>
        l.line_type === SUPPORT_COMPLETION_LINE_TYPE &&
        l.cleaner_id === support.cleaner_id,
    );
    if (support.status === "completed" && !hasLine) {
      issues.push({
        code: "MISSING_SUPPORT_EARNING_LINE",
        severity: "error",
        message: `Support cleaner ${support.cleaner_id.slice(0, 8)} confirmed participation but has no earning line.`,
      });
    }
    if (support.status !== "completed" && support.status !== "removed" && support.status !== "declined") {
      const leadCompleted = ["completed", "payout_ready", "paid_out"].includes(booking.status);
      if (leadCompleted) {
        issues.push({
          code: "MISSING_SUPPORT_CONFIRMATION",
          severity: "info",
          message: `Accepted support ${support.cleaner_id.slice(0, 8)} has not confirmed participation; no support earning line expected.`,
        });
      }
    }
  }

  const supportLines = completionLines.filter(
    (l) => l.line_type === SUPPORT_COMPLETION_LINE_TYPE,
  );
  for (const line of supportLines) {
    const rosterRow = roster.find((r) => r.cleaner_id === line.cleaner_id && r.role === "support");
    if (!rosterRow || rosterRow.status !== "completed") {
      issues.push({
        code: "ORPHAN_SUPPORT_EARNING_LINE",
        severity: "error",
        message: `Support earning line ${line.id.slice(0, 8)} has no confirmed roster participation.`,
      });
    }
  }

  const byCleaner = new Map<string, number>();
  for (const line of completionLines) {
    byCleaner.set(line.cleaner_id, (byCleaner.get(line.cleaner_id) ?? 0) + 1);
  }
  for (const [cleanerId, count] of byCleaner) {
    if (count > 1) {
      issues.push({
        code: "DUPLICATE_CLEANER_COMPLETION_LINES",
        severity: "error",
        message: `Cleaner ${cleanerId.slice(0, 8)} has ${count} completion earning lines for this booking.`,
      });
    }
  }

  if (totalPoolCents != null && expectedShareCents != null) {
    const primaryLine = completionLines.find(
      (l) =>
        l.line_type === PRIMARY_COMPLETION_LINE_TYPE &&
        l.cleaner_id === booking.cleaner_id,
    );
    if (primaryLine && primaryLine.payout_amount_cents !== expectedShareCents && acceptedSupport.length > 0) {
      issues.push({
        code: "PRIMARY_SPLIT_MISMATCH",
        severity: "error",
        message: `Primary line payout (${primaryLine.payout_amount_cents}) differs from expected equal share (${expectedShareCents}).`,
      });
    }

    for (const line of supportLines) {
      if (line.payout_amount_cents !== expectedShareCents) {
        issues.push({
          code: "SUPPORT_SPLIT_MISMATCH",
          severity: "error",
          message: `Support line payout (${line.payout_amount_cents}) differs from expected equal share (${expectedShareCents}).`,
        });
      }
    }

    if (recordedPayoutCents > totalPoolCents) {
      issues.push({
        code: "PAYOUT_EXCEEDS_POOL",
        severity: "error",
        message: `Recorded completion payouts (${recordedPayoutCents}) exceed team pool (${totalPoolCents}).`,
      });
    }

    const expectedTotalIfAllConfirmed =
      expectedShareCents * (1 + confirmedSupport.length);
    if (
      confirmedSupport.length > 0 &&
      recordedPayoutCents > 0 &&
      recordedPayoutCents < expectedTotalIfAllConfirmed &&
      recordedPayoutCents <= totalPoolCents
    ) {
      issues.push({
        code: "PAYOUT_UNDER_RECORDED",
        severity: "warning",
        message: "Recorded payouts are below the total for all confirmed participants.",
      });
    }
  }

  const { blockingIssues, warnings } = partitionReconciliationIssues(issues);
  const status = deriveReconciliationStatus(enabled, blockingIssues, warnings);

  return {
    enabled: true,
    splitPolicy: acceptedSupport.length > 0 ? "equal" : null,
    expectedParticipantCount,
    expectedShareCents,
    totalPoolCents,
    recordedPayoutCents,
    status,
    canMarkPayoutReady: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    issues,
  };
}
