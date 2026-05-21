import type { AdminOperationalAuditRow } from "@/lib/database/types";
import type { AdminOperationalAuditEntry } from "@/features/dashboards/server/types";
import { summarizeAdminOperationalMetadata } from "./recordAdminOperationalAudit";

export const ADMIN_OPERATIONAL_AUDIT_ACTION_LABELS: Record<string, string> = {
  assignment_recovery: "Assignment recovery",
  deferred_dispatch_now: "Dispatch now (deferred)",
  manual_dispatch_offer: "Manual dispatch offer",
  replace_open_offer: "Replace open offer",
  notification_requeue: "Notification requeue",
};

const OUTCOME_LABELS: Record<string, string> = {
  success: "Success",
  idempotent: "Idempotent (no change)",
  rejected: "Rejected",
  failed: "Failed",
};

export function mapAdminOperationalAuditRow(
  row: AdminOperationalAuditRow,
  adminLabel: string | null = null,
): AdminOperationalAuditEntry {
  return {
    id: row.id,
    at: row.created_at,
    adminProfileId: row.admin_profile_id,
    adminLabel,
    action: row.action,
    actionLabel: ADMIN_OPERATIONAL_AUDIT_ACTION_LABELS[row.action] ?? row.action,
    outcome: row.outcome,
    outcomeLabel: OUTCOME_LABELS[row.outcome] ?? row.outcome,
    reason: row.reason?.trim() ? row.reason.trim() : null,
    resultCode: row.result_code?.trim() ? row.result_code.trim() : null,
    cleanerId: row.cleaner_id,
    offerId: row.offer_id,
    cancelledOfferId: row.cancelled_offer_id,
    bookingStatusBefore: row.booking_status_before,
    bookingStatusAfter: row.booking_status_after,
    idempotencyKey: row.idempotency_key,
    metadataSummary: summarizeAdminOperationalMetadata(
      row.metadata as Record<string, unknown>,
    ),
  };
}
