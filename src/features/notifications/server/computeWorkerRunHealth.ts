import {
  WORKER_RUN_HEALTHY_MAX_MINUTES,
  WORKER_RUN_STALE_MINUTES,
  type WorkerRunHealthLevel,
} from "./notificationWorkerRunTypes";

export function computeWorkerRunHealth(
  completedAt: string | null,
  now: Date = new Date(),
): { level: WorkerRunHealthLevel; ageMinutes: number | null; message: string } {
  if (!completedAt) {
    return {
      level: "unknown",
      ageMinutes: null,
      message: "No worker runs recorded yet.",
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

  if (ageMinutes <= WORKER_RUN_HEALTHY_MAX_MINUTES) {
    return {
      level: "healthy",
      ageMinutes,
      message: `Last run ${ageMinutes === 0 ? "just now" : `${ageMinutes}m ago`} — cron appears healthy.`,
    };
  }

  if (ageMinutes <= WORKER_RUN_STALE_MINUTES) {
    return {
      level: "warning",
      ageMinutes,
      message: `No worker run in ${ageMinutes}m — check scheduler (expected every 2–5 min).`,
    };
  }

  return {
    level: "critical",
    ageMinutes,
    message: `No worker run in ${ageMinutes}m — verify pg_cron, deployment, and CRON_SECRET.`,
  };
}
