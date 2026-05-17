import { floorToUtcHour } from "./notificationMetricsHourlyUtc";

/** Classify a worker run for rollup-coverage eligibility (pure, for tests). */
export function isWorkerRunEligibleWithRollupCoverage(
  completedAtIso: string,
  workerRunsCutoffIso: string,
  coveredUtcHourKeys: ReadonlySet<string>,
): boolean {
  const completedMs = Date.parse(completedAtIso);
  const cutoffMs = Date.parse(workerRunsCutoffIso);
  if (!Number.isFinite(completedMs) || !Number.isFinite(cutoffMs)) {
    return false;
  }
  if (completedMs >= cutoffMs) {
    return false;
  }
  const hourKey = floorToUtcHour(new Date(completedMs)).toISOString();
  return coveredUtcHourKeys.has(hourKey);
}

export function countWorkerRunsRollupEligibility(
  completedAtTimestamps: string[],
  workerRunsCutoffIso: string,
  coveredUtcHourKeys: ReadonlySet<string>,
): { eligible: number; protectedMissingRollup: number } {
  let eligible = 0;
  let protectedMissingRollup = 0;

  for (const completedAt of completedAtTimestamps) {
    if (isWorkerRunEligibleWithRollupCoverage(completedAt, workerRunsCutoffIso, coveredUtcHourKeys)) {
      eligible += 1;
    } else {
      const completedMs = Date.parse(completedAt);
      const cutoffMs = Date.parse(workerRunsCutoffIso);
      if (Number.isFinite(completedMs) && Number.isFinite(cutoffMs) && completedMs < cutoffMs) {
        protectedMissingRollup += 1;
      }
    }
  }

  return { eligible, protectedMissingRollup };
}

export function buildUtcHourCoverageSet(bucketStartIsoList: string[]): Set<string> {
  const keys = new Set<string>();
  for (const iso of bucketStartIsoList) {
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) continue;
    keys.add(floorToUtcHour(new Date(parsed)).toISOString());
  }
  return keys;
}
