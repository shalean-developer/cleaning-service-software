import type { SupportSlaCategory } from "./supportRequestPriority";
import { supportRequestSlaCategory } from "./supportRequestPriority";

export type SupportSlaStatus = "healthy" | "warning" | "breached";
export type SupportAgeBucket = "under_1h" | "1_to_8h" | "8_to_24h" | "24_to_48h" | "over_48h";

export const SUPPORT_SLA_TARGETS = {
  urgentFirstResponseMinutes: 60,
  standardFirstResponseMinutes: 8 * 60,
  urgentResolutionMinutes: 24 * 60,
  standardResolutionMinutes: 72 * 60,
  /** Fraction of target elapsed before warning. */
  warningThresholdRatio: 0.8,
} as const;

function minutesBetween(startIso: string, endMs: number): number {
  return Math.max(0, (endMs - new Date(startIso).getTime()) / 60_000);
}

function slaStatusFromElapsed(
  elapsedMinutes: number,
  targetMinutes: number,
): SupportSlaStatus {
  if (elapsedMinutes >= targetMinutes) return "breached";
  if (elapsedMinutes >= targetMinutes * SUPPORT_SLA_TARGETS.warningThresholdRatio) {
    return "warning";
  }
  return "healthy";
}

export function supportRequestAgeBucket(ageMinutes: number): SupportAgeBucket {
  if (ageMinutes < 60) return "under_1h";
  if (ageMinutes < 8 * 60) return "1_to_8h";
  if (ageMinutes < 24 * 60) return "8_to_24h";
  if (ageMinutes < 48 * 60) return "24_to_48h";
  return "over_48h";
}

export function firstResponseTargetMinutes(category: SupportSlaCategory): number {
  return category === "urgent"
    ? SUPPORT_SLA_TARGETS.urgentFirstResponseMinutes
    : SUPPORT_SLA_TARGETS.standardFirstResponseMinutes;
}

export function resolutionTargetMinutes(category: SupportSlaCategory): number {
  return category === "urgent"
    ? SUPPORT_SLA_TARGETS.urgentResolutionMinutes
    : SUPPORT_SLA_TARGETS.standardResolutionMinutes;
}

export type SupportRequestSlaSnapshot = {
  slaCategory: SupportSlaCategory;
  slaStatus: SupportSlaStatus;
  ageBucket: SupportAgeBucket;
  ageMinutes: number;
  firstResponseTargetMinutes: number;
  resolutionTargetMinutes: number;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  timeToFirstResponseMinutes: number | null;
  timeToResolutionMinutes: number | null;
};

/**
 * SLA status for triage visibility only — does not trigger booking/payment mutations.
 */
export function supportRequestSlaStatus(input: {
  status: string;
  requestType: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  scheduledStart: string | null;
  requestedDateTimeIso: string | null;
  now?: Date;
}): SupportRequestSlaSnapshot {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const slaCategory = supportRequestSlaCategory({
    requestType: input.requestType,
    scheduledStart: input.scheduledStart,
    requestedDateTimeIso: input.requestedDateTimeIso,
    now,
  });

  const ageMinutes = minutesBetween(input.createdAt, nowMs);
  const ageBucket = supportRequestAgeBucket(ageMinutes);
  const frTarget = firstResponseTargetMinutes(slaCategory);
  const resTarget = resolutionTargetMinutes(slaCategory);

  const firstResponseDueAt =
    input.status === "open"
      ? new Date(new Date(input.createdAt).getTime() + frTarget * 60_000).toISOString()
      : null;

  const ackStart = input.acknowledgedAt ?? (input.status !== "open" ? input.updatedAt : null);
  const resolutionDueAt =
    input.status === "acknowledged" && ackStart
      ? new Date(new Date(ackStart).getTime() + resTarget * 60_000).toISOString()
      : null;

  let slaStatus: SupportSlaStatus = "healthy";
  if (input.status === "open") {
    slaStatus = slaStatusFromElapsed(ageMinutes, frTarget);
  } else if (input.status === "acknowledged" && ackStart) {
    slaStatus = slaStatusFromElapsed(minutesBetween(ackStart, nowMs), resTarget);
  }

  const timeToFirstResponseMinutes =
    input.status !== "open" && ackStart
      ? minutesBetween(input.createdAt, new Date(ackStart).getTime())
      : null;

  const timeToResolutionMinutes =
    input.resolvedAt != null
      ? minutesBetween(input.createdAt, new Date(input.resolvedAt).getTime())
      : null;

  return {
    slaCategory,
    slaStatus,
    ageBucket,
    ageMinutes,
    firstResponseTargetMinutes: frTarget,
    resolutionTargetMinutes: resTarget,
    firstResponseDueAt,
    resolutionDueAt,
    timeToFirstResponseMinutes,
    timeToResolutionMinutes,
  };
}
