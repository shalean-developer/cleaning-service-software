import type { DeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import { labelForAssignmentAttention } from "@/features/bookings/server/statusLabels";
import type { CronHealthLevel, CronJobHealthSnapshot } from "@/features/operations/server/cronHealthTypes";
import type { AdminAssignmentQueueItem } from "@/features/dashboards/server/types";

export type AdminAssignmentQueueScanLine = {
  scheduleLabel: string;
  assignmentLabel: string;
  nextAction: string;
  sameDayNote: string | null;
};

/** Always-visible ops scan line for assignment workbench cards (presentation only). */
export function adminAssignmentQueueScanLine(
  item: Pick<
    AdminAssignmentQueueItem,
    "scheduleLabel" | "assignmentAttention" | "assignmentReason" | "queueReason"
  >,
  options?: { sameDayNote?: string | null },
): AdminAssignmentQueueScanLine {
  return {
    scheduleLabel: item.scheduleLabel,
    assignmentLabel: labelForAssignmentAttention(
      item.assignmentAttention,
      item.assignmentReason,
    ),
    nextAction: item.queueReason,
    sameDayNote: options?.sameDayNote ?? null,
  };
}

export type CronHealthSummary = {
  worstLevel: CronHealthLevel;
  criticalCount: number;
  warningCount: number;
  healthyCount: number;
  criticalJobs: CronJobHealthSnapshot[];
};

export function summarizeCronHealth(jobs: CronJobHealthSnapshot[]): CronHealthSummary {
  const criticalJobs = jobs.filter((j) => j.status === "critical");
  const warningCount = jobs.filter((j) => j.status === "warning").length;
  const healthyCount = jobs.filter((j) => j.status === "healthy").length;
  const worstLevel: CronHealthLevel = criticalJobs.length
    ? "critical"
    : warningCount > 0
      ? "warning"
      : healthyCount > 0
        ? "healthy"
        : "unknown";

  return {
    worstLevel,
    criticalCount: criticalJobs.length,
    warningCount,
    healthyCount,
    criticalJobs,
  };
}

export function cronHealthNeedsAttention(summary: CronHealthSummary): boolean {
  return summary.worstLevel === "critical" || summary.worstLevel === "warning";
}

export function deferredDiagnosticsNeedsAttention(
  diagnostics: DeferredAssignmentDiagnostics,
): boolean {
  return diagnostics.overdueDispatchCount > 0;
}

export type AssignmentQueuePresetId =
  | "all"
  | "needs_attention"
  | "paid_no_offer"
  | "offer_expired";

export const ASSIGNMENT_QUEUE_PRESETS: readonly {
  id: AssignmentQueuePresetId;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "paid_no_offer", label: "Paid, no offer" },
  { id: "offer_expired", label: "Offer expired" },
] as const;

/** Client-side preset filter. does not change server queue fetch. */
export function matchesAssignmentQueuePreset(
  item: AdminAssignmentQueueItem,
  preset: AssignmentQueuePresetId,
): boolean {
  switch (preset) {
    case "all":
      return true;
    case "needs_attention":
      return item.opsAdminRequired || item.manualInterventionNeeded;
    case "paid_no_offer":
      return (
        item.openOffers.length === 0 &&
        (item.status === "confirmed" || item.recoveryCronCanHandle || item.assignmentAttention === "dispatch_not_started")
      );
    case "offer_expired":
      return (
        item.assignmentReason?.toLowerCase().includes("expired") === true ||
        item.assignmentAttention === "max_attempts_admin"
      );
    default:
      return true;
  }
}

export function queueCountForPreset(
  items: AdminAssignmentQueueItem[],
  preset: AssignmentQueuePresetId,
): number {
  return items.filter((item) => matchesAssignmentQueuePreset(item, preset)).length;
}
