import type { NotificationRetentionPolicy } from "./notificationRetentionConfig";

export type NotificationRetentionOldestEligible = {
  liveSent: string | null;
  dryRunSent: string | null;
  failedExpired: string | null;
  unsupportedPending: string | null;
  workerRuns: string | null;
  metricsHourly: string | null;
};

export type NotificationRetentionOutboxEligible = {
  liveSentOlderThanPolicy: number;
  dryRunSentOlderThanPolicy: number;
  failedOlderThanPolicy: number;
  unsupportedPendingOlderThanPolicy: number;
};

export type NotificationRetentionOutboxProtected = {
  pendingDeliverable: number;
  processing: number;
  failedWithinRetention: number;
  requeueShieldRecent: number;
};

export type NotificationRetentionWorkerRuns = {
  olderThanPolicy: number;
  eligibleWithRollupCoverage: number;
  protectedMissingRollup: number;
};

export type NotificationRetentionMetricsHourly = {
  olderThanPolicy: number;
};

export type NotificationRetentionDryRunReport = {
  dryRun: true;
  deleted: 0;
  asOf: string;
  policy: Pick<
    NotificationRetentionPolicy,
    | "outboxLiveSentDays"
    | "outboxDryRunSentDays"
    | "outboxFailedMaxDays"
    | "outboxUnsupportedPendingDays"
    | "workerRunsDays"
    | "metricsMonths"
    | "requeueShieldDays"
  >;
  eligible: {
    outbox: NotificationRetentionOutboxEligible;
    workerRuns: NotificationRetentionWorkerRuns;
    metricsHourly: NotificationRetentionMetricsHourly;
  };
  protected: {
    outbox: NotificationRetentionOutboxProtected;
  };
  oldestEligible: NotificationRetentionOldestEligible;
};
