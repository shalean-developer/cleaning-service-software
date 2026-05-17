/** UTC hour helpers for notification_metrics_hourly rollups (5H-b). */

export const NOTIFICATION_METRICS_MAX_BACKFILL_HOURS = 168;
/** Parallel rollups during backfill (each hour = 2 DB round-trips). */
export const NOTIFICATION_METRICS_BACKFILL_CONCURRENCY = 8;

export function floorToUtcHour(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      0,
      0,
      0,
    ),
  );
}

/** Previous fully closed UTC hour (never the in-progress hour). */
export function previousClosedUtcHour(now: Date = new Date()): Date {
  const currentHour = floorToUtcHour(now);
  return new Date(currentHour.getTime() - 60 * 60_000);
}

export function bucketEndExclusive(bucketStart: Date): Date {
  return new Date(bucketStart.getTime() + 60 * 60_000);
}

export function parseUtcHourBucketStart(value: string): Date | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return floorToUtcHour(new Date(parsed));
}

export function isCurrentPartialUtcHour(bucketStart: Date, now: Date = new Date()): boolean {
  return bucketStart.getTime() >= floorToUtcHour(now).getTime();
}
