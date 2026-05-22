import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";
import type { AdminRunbookKey } from "@/features/dashboards/server/adminRunbooks";

export type AdminOperationalQueueKey =
  | "needs_assignment"
  | "dispatch_not_started"
  | "recovery_needed"
  | "payment_attention"
  | "assignment_attention";

export type AdminOperationalQueueSeverity =
  | "informational"
  | "monitor"
  | "action_required"
  | "urgent";

export type AdminOperationalQueueExplainability = {
  severity: AdminOperationalQueueSeverity;
  summary: string;
  whyHere: readonly string[];
  recommendedAction: string;
  secondaryNote?: string;
  runbookKey: AdminRunbookKey;
  secondaryRunbookKey?: AdminRunbookKey;
};

export type AdminOperationalQueueDefinition = {
  key: AdminOperationalQueueKey;
  label: string;
  filter: AdminBookingFilter;
  tone: "neutral" | "warning" | "danger" | "info";
  explainability: AdminOperationalQueueExplainability;
};

export type AdminOperationalQueueCountSnapshot = {
  key: AdminOperationalQueueKey;
  label: string;
  count: number;
  href: string;
  tone: "neutral" | "warning" | "danger" | "info";
};

export type AdminOperationalQueueCard = AdminOperationalQueueCountSnapshot &
  AdminOperationalQueueExplainability;

const QUEUE_EXPLAINABILITY = {
  needs_assignment: {
    severity: "action_required",
    summary:
      "Bookings that are paid (or otherwise ready) but still have no assigned cleaner. the system is waiting to start or complete dispatch.",
    whyHere: [
      "status is pending_assignment",
      "No cleaner is assigned yet",
      "Includes bookings before the first offer is sent",
    ],
    recommendedAction:
      "Open the filtered list and, for each booking, use Send offer to cleaner on booking detail when manual dispatch is eligible.",
    secondaryNote:
      "If dispatch should have started automatically, check payment and assignment metadata on booking detail before sending a manual offer.",
    runbookKey: "adminDashboard",
  },
  dispatch_not_started: {
    severity: "monitor",
    summary:
      "Paid bookings where assignment dispatch never started or visibility shows dispatch not started. often right after payment or a failed auto-dispatch.",
    whyHere: [
      'Assignment reason contains "dispatch not started", or',
      "Paid confirmed booking past the recovery grace window with no open or accepted offers",
      "Monitoring view. overlaps with recovery visibility but separate from assignment attention",
    ],
    recommendedAction:
      "Monitor the list. recovery cron may pick up eligible bookings. For a single stuck booking, open detail and use Recover assignment when eligibility shows eligible.",
    secondaryNote:
      "Do not batch-recover from this page. See the assignment recovery runbook for cron vs manual timing.",
    runbookKey: "assignmentRecovery",
  },
  recovery_needed: {
    severity: "action_required",
    summary:
      "Bookings that need post-payment assignment recovery. dispatch did not complete and the booking is eligible (or flagged) for the recovery path.",
    whyHere: [
      "Recovery eligibility is eligible on booking detail, or",
      "Assignment visibility key is dispatch_not_started",
      "Same filter bundle as dispatch not started. use this queue when actively recovering",
    ],
    recommendedAction:
      "Open each booking and run Recover assignment when the operational panel shows eligibility eligible. Otherwise wait for cron or investigate grace / in-progress states on detail.",
    secondaryNote:
      "Bookings in grace period may appear in related filters but are not yet eligible for recovery.",
    runbookKey: "assignmentRecovery",
  },
  payment_attention: {
    severity: "urgent",
    summary:
      "Bookings whose payment failed or could not be completed. the job cannot proceed until the customer retries checkout.",
    whyHere: [
      "status is payment_failed",
      "Customer must complete payment again. admin cannot finalize payment in the dashboard",
    ],
    recommendedAction:
      "Confirm the customer has been notified and direct them to retry from their booking/payment flow. Use booking detail to verify outbox notifications if needed.",
    secondaryNote: "Admin cannot charge or retry Paystack on behalf of the customer.",
    runbookKey: "paymentFailedRetry",
  },
  assignment_attention: {
    severity: "action_required",
    summary:
      "Bookings that need assignment triage. needs assignment, selected cleaner declined, max dispatch attempts, or legacy attention metadata.",
    whyHere: [
      "Visibility key is needs_assignment, selected_declined_admin, or max_attempts_admin, or",
      "Stale attention_required metadata on confirmed without a visibility key",
      "Excludes dispatch-not-started and recovery-only cases (separate queues)",
    ],
    recommendedAction:
      "Open the filtered bookings list for global triage. For day-to-day scanning, also use /admin/assignments. per-booking guidance and badges live there.",
    secondaryNote:
      "This count is exact across all bookings. The assignments work queue scans only the newest 100 pending_assignment / confirmed rows. the two numbers often differ.",
    runbookKey: "assignmentDeclineRedispatch",
    secondaryRunbookKey: "adminDashboard",
  },
} as const satisfies Record<AdminOperationalQueueKey, AdminOperationalQueueExplainability>;

/** Stage 7A-1 operational queues. booking filter deep links use exact SQL counts (Stage 6C). */
export const ADMIN_OPERATIONAL_QUEUES: readonly AdminOperationalQueueDefinition[] = [
  {
    key: "needs_assignment",
    label: "Needs assignment",
    filter: "pending_assignment",
    tone: "warning",
    explainability: QUEUE_EXPLAINABILITY.needs_assignment,
  },
  {
    key: "dispatch_not_started",
    label: "Dispatch not started",
    filter: "dispatch_not_started",
    tone: "warning",
    explainability: QUEUE_EXPLAINABILITY.dispatch_not_started,
  },
  {
    key: "recovery_needed",
    label: "Recovery needed",
    filter: "recovery_needed",
    tone: "info",
    explainability: QUEUE_EXPLAINABILITY.recovery_needed,
  },
  {
    key: "payment_attention",
    label: "Payment attention",
    filter: "payment_failed",
    tone: "danger",
    explainability: QUEUE_EXPLAINABILITY.payment_attention,
  },
  {
    key: "assignment_attention",
    label: "Assignment attention",
    filter: "assignment_attention",
    tone: "warning",
    explainability: QUEUE_EXPLAINABILITY.assignment_attention,
  },
] as const;

export function adminOperationalQueueHref(filter: AdminBookingFilter): string {
  return `/admin/bookings?filter=${filter}`;
}

const QUEUE_BY_KEY = new Map(ADMIN_OPERATIONAL_QUEUES.map((queue) => [queue.key, queue]));
const QUEUE_BY_FILTER = new Map(ADMIN_OPERATIONAL_QUEUES.map((queue) => [queue.filter, queue]));

export const ADMIN_OPERATIONAL_QUEUE_FILTERS = ADMIN_OPERATIONAL_QUEUES.map((q) => q.filter);

export function isAdminOperationalQueueFilter(
  filter: AdminBookingFilter | undefined,
): filter is (typeof ADMIN_OPERATIONAL_QUEUE_FILTERS)[number] {
  return filter != null && QUEUE_BY_FILTER.has(filter);
}

export function getAdminOperationalQueueForFilter(
  filter: AdminBookingFilter,
): AdminOperationalQueueDefinition | undefined {
  return QUEUE_BY_FILTER.get(filter);
}

/** Active-filter context card for /admin/bookings (7A-2b). */
export function buildAdminOperationalQueueContextCard(
  filter: AdminBookingFilter,
  queues: readonly AdminOperationalQueueCountSnapshot[],
): AdminOperationalQueueCard | null {
  const def = getAdminOperationalQueueForFilter(filter);
  if (!def) return null;
  const snapshot = queues.find((q) => q.key === def.key);
  if (!snapshot) return null;
  return buildAdminOperationalQueueCards([snapshot])[0] ?? null;
}

export function getAdminOperationalQueueDefinition(
  key: AdminOperationalQueueKey,
): AdminOperationalQueueDefinition {
  const queue = QUEUE_BY_KEY.get(key);
  if (!queue) {
    throw new Error(`Unknown operational queue key: ${key}`);
  }
  return queue;
}

/** Merges live counts (7A-1) with static explainability copy (7A-2). */
export function buildAdminOperationalQueueCards(
  queues: readonly AdminOperationalQueueCountSnapshot[],
): AdminOperationalQueueCard[] {
  return queues.map((item) => {
    const def = getAdminOperationalQueueDefinition(item.key);
    return {
      ...item,
      ...def.explainability,
    };
  });
}

export function labelForOperationalQueueSeverity(severity: AdminOperationalQueueSeverity): string {
  switch (severity) {
    case "urgent":
      return "Urgent";
    case "action_required":
      return "Action needed";
    case "monitor":
      return "Monitor";
    case "informational":
      return "Informational";
  }
}

export function toneForOperationalQueueSeverity(
  severity: AdminOperationalQueueSeverity,
): "neutral" | "info" | "warning" | "danger" {
  switch (severity) {
    case "urgent":
      return "danger";
    case "action_required":
      return "warning";
    case "monitor":
      return "info";
    case "informational":
      return "neutral";
  }
}
