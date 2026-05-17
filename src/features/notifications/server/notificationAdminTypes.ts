import type { AdminNotificationOutboxEntry } from "@/features/dashboards/server/types";
import type {
  NotificationQueuePressure,
  NotificationWorker24hAnalytics,
} from "./notificationAnalyticsAggregates";
import type { AdminNotificationTrends7d } from "./notificationTrends7d";
import type {
  AdminNotificationWorkerHealthModel,
  AdminNotificationWorkerRunListItem,
} from "./notificationWorkerRunTypes";
import type { NotificationRetentionDryRunReport } from "./notificationRetentionTypes";

export type NotificationTemplateStatusCounts = {
  sent: number;
  failed: number;
  pending: number;
  processing: number;
};

export type NotificationDeliverableTemplateRow = {
  template: string;
  channel: string;
  counts: NotificationTemplateStatusCounts;
};

export type NotificationUnsupportedTemplateRow = {
  template: string;
  pending: number;
};

export type AdminNotificationAnalytics = {
  worker24h: NotificationWorker24hAnalytics;
  trends7d: AdminNotificationTrends7d;
  queuePressure: NotificationQueuePressure;
  deliverableTemplates: NotificationDeliverableTemplateRow[];
  unsupportedTemplates: NotificationUnsupportedTemplateRow[];
  /** True when configured provider is dry_run with delivery enabled. */
  dryRunModeActive: boolean;
};

export const ADMIN_NOTIFICATION_GLOBAL_LIST_LIMIT = 100;

export type NotificationDeliverableFilter = "true" | "false" | "all";

export type NotificationHealthFilters = {
  status: Array<"pending" | "processing" | "sent" | "failed">;
  template: string | null;
  deliverable: NotificationDeliverableFilter;
};

export type NotificationHealthSummary = {
  sent: number;
  actionablePending: number;
  scheduledRetry: number;
  processing: number;
  failed: number;
  staleProcessing: number;
  unsupportedPending: number;
  dryRun: number;
};

export type AdminNotificationDeliveryBannerModel = {
  deliveryEnabled: boolean;
  canRunDelivery: boolean;
  emailProvider: "dry_run" | "resend" | "disabled";
  /** True when Resend mode has NOTIFICATION_FROM_EMAIL + RESEND_API_KEY. */
  resendConfigured: boolean;
  /** Shown when delivery is on but the active provider cannot send. */
  readinessHint: string | null;
  appBaseUrl: string;
  appBaseUrlWarning: string | null;
  staleProcessingMinutes: number;
};

export type AdminNotificationHealthPageResult = {
  summary: NotificationHealthSummary;
  oldestActionablePendingAgeMs: number | null;
  rows: AdminNotificationOutboxEntry[];
  filters: NotificationHealthFilters;
  banner: AdminNotificationDeliveryBannerModel;
  analytics: AdminNotificationAnalytics;
  workerHealth: AdminNotificationWorkerHealthModel;
  recentWorkerRuns: AdminNotificationWorkerRunListItem[];
  retentionDryRun: NotificationRetentionDryRunReport;
};
