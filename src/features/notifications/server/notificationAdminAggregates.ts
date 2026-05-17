import type { NotificationOutboxAdminRowInput } from "./mapNotificationOutboxRowForAdmin";
import {
  isDeliverableNotificationRow,
  isDryRunLastError,
  isRetryDue,
  isStaleProcessingRow,
} from "./notificationOutboxDeliverability";
import type { NotificationHealthSummary } from "./notificationAdminTypes";

/**
 * Pure aggregation for tests and optional in-memory reconciliation.
 * Production read model uses parallel SQL count queries with the same rules.
 */
export function computeNotificationHealthSummaryFromRows(
  rows: NotificationOutboxAdminRowInput[],
  options: { now: Date; staleMinutes: number },
): NotificationHealthSummary {
  const nowIso = options.now.toISOString();
  const summary: NotificationHealthSummary = {
    sent: 0,
    actionablePending: 0,
    scheduledRetry: 0,
    processing: 0,
    failed: 0,
    staleProcessing: 0,
    unsupportedPending: 0,
    dryRun: 0,
  };

  for (const row of rows) {
    const deliverable = isDeliverableNotificationRow(row);
    if (isDryRunLastError(row.last_error) && deliverable) {
      summary.dryRun += 1;
    }

    if (!deliverable) {
      if (row.status === "pending") {
        summary.unsupportedPending += 1;
      }
      continue;
    }

    switch (row.status) {
      case "sent":
        summary.sent += 1;
        break;
      case "failed":
        summary.failed += 1;
        break;
      case "processing":
        summary.processing += 1;
        if (isStaleProcessingRow(row.updated_at, options.now, options.staleMinutes)) {
          summary.staleProcessing += 1;
        }
        break;
      case "pending":
        if (isRetryDue(row.next_retry_at, nowIso)) {
          summary.actionablePending += 1;
        } else {
          summary.scheduledRetry += 1;
        }
        break;
      default:
        break;
    }
  }

  return summary;
}

export function findOldestActionablePendingAgeMs(
  rows: NotificationOutboxAdminRowInput[],
  now: Date,
): number | null {
  const nowIso = now.toISOString();
  let oldest: string | null = null;
  for (const row of rows) {
    if (row.status !== "pending") continue;
    if (!isDeliverableNotificationRow(row)) continue;
    if (!isRetryDue(row.next_retry_at, nowIso)) continue;
    if (oldest == null || row.created_at < oldest) {
      oldest = row.created_at;
    }
  }
  if (oldest == null) return null;
  return now.getTime() - new Date(oldest).getTime();
}
