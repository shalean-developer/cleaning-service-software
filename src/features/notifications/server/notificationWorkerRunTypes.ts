import type { Json } from "@/lib/database/types";
import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";

export type NotificationWorkerRunTriggerSource = "cron" | "manual";

export type WorkerRunHealthLevel = "healthy" | "warning" | "critical" | "unknown";

export const WORKER_RUN_HEALTHY_MAX_MINUTES = 10;
export const WORKER_RUN_STALE_MINUTES = 15;

export type NotificationWorkerRunRow = {
  id: string;
  started_at: string | null;
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
  errors: Json;
  created_at: string;
};

export type AdminNotificationWorkerHealthModel = {
  hasRun: boolean;
  completedAt: string | null;
  ageMinutes: number | null;
  healthLevel: WorkerRunHealthLevel;
  healthMessage: string;
  ok: boolean | null;
  deliveryEnabled: boolean | null;
  emailProvider: string | null;
  triggerSource: NotificationWorkerRunTriggerSource | null;
  reclaimed: number | null;
  scanned: number | null;
  sent: number | null;
  skipped: number | null;
  failed: number | null;
  dryRun: number | null;
  errorCount: number | null;
};

/** Recent worker runs shown on /admin/notifications (5G-b). */
export const RECENT_WORKER_RUNS_LIMIT = 15;

export type AdminNotificationWorkerRunListItem = {
  idShort: string;
  completedAt: string;
  ageMinutes: number;
  ok: boolean;
  statusLabel: string;
  statusTone: StatusBadgeTone;
  triggerSource: NotificationWorkerRunTriggerSource;
  emailProvider: string | null;
  deliveryEnabled: boolean;
  reclaimed: number;
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  dryRun: number;
  errorCount: number;
};
