import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";
import type {
  AdminNotificationWorkerRunListItem,
  NotificationWorkerRunTriggerSource,
} from "./notificationWorkerRunTypes";

export type NotificationWorkerRunAdminRowInput = {
  id: string;
  completed_at: string;
  ok: boolean;
  delivery_enabled: boolean;
  email_provider: string | null;
  trigger_source: NotificationWorkerRunTriggerSource;
  reclaimed: number;
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  dry_run: number;
  error_count: number;
};

export function shortWorkerRunId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function computeWorkerRunListStatus(
  ok: boolean,
  failed: number,
  errorCount: number,
): { label: string; tone: StatusBadgeTone } {
  if (!ok) {
    return { label: "Failed", tone: "danger" };
  }
  if (failed > 0 || errorCount > 0) {
    return { label: "Partial", tone: "warning" };
  }
  return { label: "OK", tone: "success" };
}

export function formatWorkerRunAge(ageMinutes: number): string {
  if (ageMinutes <= 0) return "just now";
  return `${ageMinutes}m ago`;
}

export function mapNotificationWorkerRunForAdmin(
  row: NotificationWorkerRunAdminRowInput,
  now: Date = new Date(),
): AdminNotificationWorkerRunListItem {
  const completedMs = Date.parse(row.completed_at);
  const ageMinutes = Number.isFinite(completedMs)
    ? Math.max(0, Math.floor((now.getTime() - completedMs) / 60_000))
    : 0;
  const status = computeWorkerRunListStatus(row.ok, row.failed, row.error_count);

  return {
    idShort: shortWorkerRunId(row.id),
    completedAt: row.completed_at,
    ageMinutes,
    ok: row.ok,
    statusLabel: status.label,
    statusTone: status.tone,
    triggerSource: row.trigger_source,
    emailProvider: row.email_provider,
    deliveryEnabled: row.delivery_enabled,
    reclaimed: row.reclaimed,
    scanned: row.scanned,
    sent: row.sent,
    skipped: row.skipped,
    failed: row.failed,
    dryRun: row.dry_run,
    errorCount: row.error_count,
  };
}
