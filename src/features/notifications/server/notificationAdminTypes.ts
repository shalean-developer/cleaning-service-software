import type { AdminNotificationOutboxEntry } from "@/features/dashboards/server/types";

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
};
