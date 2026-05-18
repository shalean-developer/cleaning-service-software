/** UTC hour helpers for assignment_metrics_hourly rollups (7B-1a). */

export const ASSIGNMENT_METRICS_MAX_BACKFILL_HOURS = 168;
export const ASSIGNMENT_METRICS_BACKFILL_CONCURRENCY = 8;

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

export function isTimestampInBucket(
  iso: string | null | undefined,
  bucketStart: Date,
  bucketEnd: Date,
): boolean {
  if (!iso) return false;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return false;
  return ms >= bucketStart.getTime() && ms < bucketEnd.getTime();
}
