import type { StatusBadgeTone } from "@/features/bookings/server/statusLabels";
import type { CleanerOperationalState } from "../lifecycle/operationalState";

export function labelForCleanerOperationalState(state: CleanerOperationalState): string {
  const labels: Record<CleanerOperationalState, string> = {
    onboarding: "Onboarding",
    active: "Active",
    inactive: "Inactive",
    suspended: "Suspended",
    archived: "Archived",
  };
  return labels[state];
}

export function toneForCleanerOperationalState(state: CleanerOperationalState): StatusBadgeTone {
  switch (state) {
    case "active":
      return "success";
    case "onboarding":
      return "info";
    case "inactive":
      return "neutral";
    case "suspended":
      return "warning";
    case "archived":
      return "danger";
  }
}

export function labelForCleanerLifecycleAuditAction(action: string): string {
  const labels: Record<string, string> = {
    deactivated: "Deactivated",
    suspended: "Suspended",
    reactivated: "Reactivated",
    unsuspended: "Unsuspended",
    archived: "Archived",
    open_offers_cancelled: "Open offers cancelled",
  };
  return labels[action] ?? action;
}

export const CLEANER_LIFECYCLE_UX_COPY = {
  inactive:
    "Inactive cleaners cannot receive new assignment offers. Existing bookings and completed earnings are unchanged.",
  suspended:
    "Suspended cleaners cannot receive new offers or accept open offers. Existing bookings and completed earnings are unchanged.",
  archived:
    "Archived cleaners are soft-deleted for historical reference only. They cannot be reactivated. Completed earnings remain in the ledger.",
  earnings:
    "Pending and paid earnings are preserved through lifecycle changes; archive only blocks when active assigned or in-progress bookings exist.",
} as const;
