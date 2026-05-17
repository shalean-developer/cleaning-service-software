import "server-only";

/** Retention policy defaults (Stage 5I design). Env overrides use NOTIFICATION_RETENTION_* prefix. */

export const DEFAULT_OUTBOX_LIVE_SENT_DAYS = 90;
export const DEFAULT_OUTBOX_DRY_RUN_SENT_DAYS = 60;
export const DEFAULT_OUTBOX_FAILED_MAX_DAYS = 365;
export const DEFAULT_OUTBOX_UNSUPPORTED_PENDING_DAYS = 180;
export const DEFAULT_WORKER_RUNS_DAYS = 90;
export const DEFAULT_METRICS_MONTHS = 13;
export const DEFAULT_REQUEUE_SHIELD_DAYS = 30;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export type NotificationRetentionCutoffs = {
  outboxLiveSentBefore: string;
  outboxDryRunSentBefore: string;
  outboxFailedExpiredBefore: string;
  outboxUnsupportedPendingBefore: string;
  workerRunsBefore: string;
  metricsHourlyBefore: string;
  requeueShieldSince: string;
};

export type NotificationRetentionPolicy = {
  outboxLiveSentDays: number;
  outboxDryRunSentDays: number;
  outboxFailedMaxDays: number;
  outboxUnsupportedPendingDays: number;
  workerRunsDays: number;
  metricsMonths: number;
  requeueShieldDays: number;
  cutoffs: NotificationRetentionCutoffs;
};

function subtractDays(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60_000);
}

function subtractMonths(now: Date, months: number): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

export function getNotificationRetentionPolicy(
  now: Date = new Date(),
): NotificationRetentionPolicy {
  const outboxLiveSentDays = parsePositiveInt(
    process.env.NOTIFICATION_RETENTION_OUTBOX_SENT_DAYS,
    DEFAULT_OUTBOX_LIVE_SENT_DAYS,
  );
  const outboxDryRunSentDays = parsePositiveInt(
    process.env.NOTIFICATION_RETENTION_OUTBOX_DRY_RUN_SENT_DAYS,
    DEFAULT_OUTBOX_DRY_RUN_SENT_DAYS,
  );
  const outboxFailedMaxDays = parsePositiveInt(
    process.env.NOTIFICATION_RETENTION_OUTBOX_FAILED_MAX_DAYS,
    DEFAULT_OUTBOX_FAILED_MAX_DAYS,
  );
  const outboxUnsupportedPendingDays = parsePositiveInt(
    process.env.NOTIFICATION_RETENTION_OUTBOX_UNSUPPORTED_PENDING_DAYS,
    DEFAULT_OUTBOX_UNSUPPORTED_PENDING_DAYS,
  );
  const workerRunsDays = parsePositiveInt(
    process.env.NOTIFICATION_RETENTION_WORKER_RUNS_DAYS,
    DEFAULT_WORKER_RUNS_DAYS,
  );
  const metricsMonths = parsePositiveInt(
    process.env.NOTIFICATION_RETENTION_METRICS_MONTHS,
    DEFAULT_METRICS_MONTHS,
  );
  const requeueShieldDays = parsePositiveInt(
    process.env.NOTIFICATION_RETENTION_REQUEUE_SHIELD_DAYS,
    DEFAULT_REQUEUE_SHIELD_DAYS,
  );

  return {
    outboxLiveSentDays,
    outboxDryRunSentDays,
    outboxFailedMaxDays,
    outboxUnsupportedPendingDays,
    workerRunsDays,
    metricsMonths,
    requeueShieldDays,
    cutoffs: {
      outboxLiveSentBefore: subtractDays(now, outboxLiveSentDays).toISOString(),
      outboxDryRunSentBefore: subtractDays(now, outboxDryRunSentDays).toISOString(),
      outboxFailedExpiredBefore: subtractDays(now, outboxFailedMaxDays).toISOString(),
      outboxUnsupportedPendingBefore: subtractDays(
        now,
        outboxUnsupportedPendingDays,
      ).toISOString(),
      workerRunsBefore: subtractDays(now, workerRunsDays).toISOString(),
      metricsHourlyBefore: subtractMonths(now, metricsMonths).toISOString(),
      requeueShieldSince: subtractDays(now, requeueShieldDays).toISOString(),
    },
  };
}
