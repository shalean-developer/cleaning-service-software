import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";

export type AdminOperationalQueueKey =
  | "needs_assignment"
  | "dispatch_not_started"
  | "recovery_needed"
  | "payment_attention"
  | "assignment_attention";

export type AdminOperationalQueueDefinition = {
  key: AdminOperationalQueueKey;
  label: string;
  filter: AdminBookingFilter;
  tone: "neutral" | "warning" | "danger" | "info";
};

/** Stage 7A-1 operational queues — booking filter deep links use exact SQL counts (Stage 6C). */
export const ADMIN_OPERATIONAL_QUEUES: readonly AdminOperationalQueueDefinition[] = [
  {
    key: "needs_assignment",
    label: "Needs assignment",
    filter: "pending_assignment",
    tone: "warning",
  },
  {
    key: "dispatch_not_started",
    label: "Dispatch not started",
    filter: "dispatch_not_started",
    tone: "warning",
  },
  {
    key: "recovery_needed",
    label: "Recovery needed",
    filter: "recovery_needed",
    tone: "info",
  },
  {
    key: "payment_attention",
    label: "Payment attention",
    filter: "payment_failed",
    tone: "danger",
  },
  {
    key: "assignment_attention",
    label: "Assignment attention",
    filter: "assignment_attention",
    tone: "warning",
  },
] as const;

export function adminOperationalQueueHref(filter: AdminBookingFilter): string {
  return `/admin/bookings?filter=${filter}`;
}
