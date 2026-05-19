import type { CronHealthLevel } from "./cronHealthTypes";

/** Slack above expected interval before marking a scheduled job stale. */
export const CRON_HEALTHY_SLACK_FACTOR = 1.25;

/** Multiplier of expected interval before critical staleness. */
export const CRON_STALE_FACTOR = 2;

export function computeCronJobHealthFromLastRun(
  completedAt: string | null,
  expectedIntervalMinutes: number,
  now: Date = new Date(),
): { level: CronHealthLevel; ageMinutes: number | null; message: string } {
  if (!completedAt) {
    return {
      level: "unknown",
      ageMinutes: null,
      message: "No cron run recorded yet.",
    };
  }

  const completedMs = Date.parse(completedAt);
  if (!Number.isFinite(completedMs)) {
    return {
      level: "unknown",
      ageMinutes: null,
      message: "Last run timestamp is invalid.",
    };
  }

  const ageMinutes = Math.max(0, Math.floor((now.getTime() - completedMs) / 60_000));
  const healthyMax = Math.ceil(expectedIntervalMinutes * CRON_HEALTHY_SLACK_FACTOR);
  const staleMax = Math.ceil(expectedIntervalMinutes * CRON_STALE_FACTOR);

  if (ageMinutes <= healthyMax) {
    return {
      level: "healthy",
      ageMinutes,
      message: `Last run ${ageMinutes === 0 ? "just now" : `${ageMinutes}m ago`} — within expected ${expectedIntervalMinutes}m schedule.`,
    };
  }

  if (ageMinutes <= staleMax) {
    return {
      level: "warning",
      ageMinutes,
      message: `Last run ${ageMinutes}m ago — later than expected ${expectedIntervalMinutes}m schedule.`,
    };
  }

  return {
    level: "critical",
    ageMinutes,
    message: `Last run ${ageMinutes}m ago — verify pg_cron/Vault URL, deployment, and CRON_SECRET.`,
  };
}

export function computeCronHealthFromBacklog(
  backlogCount: number,
  options: { warningThreshold?: number; criticalThreshold?: number } = {},
): { level: CronHealthLevel; message: string } {
  const warningThreshold = options.warningThreshold ?? 1;
  const criticalThreshold = options.criticalThreshold ?? 5;

  if (backlogCount <= 0) {
    return { level: "healthy", message: "No backlog detected." };
  }
  if (backlogCount >= criticalThreshold) {
    return {
      level: "critical",
      message: `${backlogCount} backlog item(s) — cron may be down or falling behind.`,
    };
  }
  if (backlogCount >= warningThreshold) {
    return {
      level: "warning",
      message: `${backlogCount} backlog item(s) — verify cron is scheduled and succeeding.`,
    };
  }
  return { level: "healthy", message: "No backlog detected." };
}

const SEVERITY_RANK: Record<CronHealthLevel, number> = {
  unknown: 0,
  healthy: 1,
  warning: 2,
  critical: 3,
};

export function mergeCronHealthLevels(
  ...levels: CronHealthLevel[]
): CronHealthLevel {
  return levels.reduce<CronHealthLevel>(
    (worst, level) => (SEVERITY_RANK[level] > SEVERITY_RANK[worst] ? level : worst),
    "unknown",
  );
}

export function mergeCronHealthMessages(
  status: CronHealthLevel,
  parts: string[],
): string {
  const unique = [...new Set(parts.filter(Boolean))];
  if (unique.length === 0) {
    return status === "healthy" ? "Healthy." : "Status unknown.";
  }
  return unique.join(" ");
}
