import type { CustomerBillingAccountGovernanceAuditAction } from "@/lib/database/types";
import type { MonthlyAccountCollectionsNote } from "./monthlyAccountCollectionsNotesRepository";
import type { CustomerBillingAccountGovernanceAuditEntry } from "./customerBillingAccountGovernanceRepository";
import type {
  MonthlyGovernanceTimelineEvent,
  MonthlyGovernanceTimelineEventKind,
} from "../monthlyAccountGovernanceTypes";
import { formatGovernanceStateLabel } from "./formatGovernanceDisplayLabels";

function auditActionKind(action: CustomerBillingAccountGovernanceAuditAction): MonthlyGovernanceTimelineEventKind {
  switch (action) {
    case "credit_limit_updated":
      return "credit_limit";
    case "override_granted":
      return "override";
    case "account_suspended":
    case "account_unsuspended":
      return "suspension";
    case "finance_review_started":
    case "finance_review_completed":
    case "finance_review_assigned":
    case "finance_review_resolved":
    case "finance_review_dismissed":
      return "finance_review";
  }
  if (action === "governance_state_changed") return "governance_state";
  return "governance_state";
}

function auditActionTitle(action: CustomerBillingAccountGovernanceAuditAction): string {
  switch (action) {
    case "governance_state_changed":
      return "Governance state changed";
    case "account_suspended":
      return "Account suspended";
    case "account_unsuspended":
      return "Account unsuspended";
    case "finance_review_started":
      return "Finance review started";
    case "finance_review_completed":
      return "Finance review completed";
    case "finance_review_assigned":
      return "Finance review owner assigned";
    case "finance_review_resolved":
      return "Finance review resolved";
    case "finance_review_dismissed":
      return "Finance review dismissed";
    case "credit_limit_updated":
      return "Credit limit updated";
    case "override_granted":
      return "Temporary override granted";
  }
  return "Governance event";
}

function noteTypeTitle(noteType: MonthlyAccountCollectionsNote["noteType"]): string {
  switch (noteType) {
    case "governance_review":
      return "Governance note";
    case "credit_limit_review":
      return "Credit limit note";
    case "suspension_reason":
      return "Suspension note";
    case "override_approval":
      return "Override approval note";
    case "dispute_resolution":
      return "Dispute note";
    case "finance_hold":
      return "Finance hold note";
    case "dispute":
      return "Dispute note";
    default:
      return "Collections note";
  }
}

function noteKind(noteType: MonthlyAccountCollectionsNote["noteType"]): MonthlyGovernanceTimelineEventKind {
  if (noteType === "dispute" || noteType === "dispute_resolution") return "dispute";
  if (
    noteType === "governance_review" ||
    noteType === "finance_review" ||
    noteType === "finance_hold"
  ) {
    return "finance_review";
  }
  return "note";
}

export function buildMonthlyGovernanceTimeline(input: {
  auditEntries: CustomerBillingAccountGovernanceAuditEntry[];
  notes: MonthlyAccountCollectionsNote[];
  adminNamesById: Record<string, string | null>;
}): MonthlyGovernanceTimelineEvent[] {
  const events: MonthlyGovernanceTimelineEvent[] = [];

  for (const entry of input.auditEntries) {
    const previous = entry.previousState ? formatGovernanceStateLabel(entry.previousState) : null;
    const next = entry.nextState ? formatGovernanceStateLabel(entry.nextState) : null;
    const stateDetail =
      previous && next ? `${previous} → ${next}` : next ?? previous ?? null;

    events.push({
      id: `audit:${entry.id}`,
      kind: auditActionKind(entry.action),
      title: auditActionTitle(entry.action),
      detail: stateDetail,
      reason: entry.reason,
      adminProfileId: entry.adminProfileId,
      adminName: input.adminNamesById[entry.adminProfileId] ?? null,
      at: entry.createdAt,
      metadata: {
        action: entry.action,
        exposureSnapshot: entry.exposureSnapshot,
        outstandingBalanceSnapshot: entry.outstandingBalanceSnapshot,
      },
    });
  }

  for (const note of input.notes) {
    const parts: string[] = [note.content];
    if (note.followUpDate) parts.push(`Follow-up: ${note.followUpDate}`);
    if (note.resolution) parts.push(`Resolution: ${note.resolution}`);

    events.push({
      id: `note:${note.id}`,
      kind: noteKind(note.noteType),
      title: noteTypeTitle(note.noteType),
      detail: parts.join(" · "),
      reason: note.content,
      adminProfileId: note.adminProfileId,
      adminName: input.adminNamesById[note.adminProfileId] ?? null,
      at: note.createdAt,
      metadata: {
        noteType: note.noteType,
        reviewOwnerAdminId: note.reviewOwnerAdminId,
        followUpDate: note.followUpDate,
        resolution: note.resolution,
      },
    });
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
