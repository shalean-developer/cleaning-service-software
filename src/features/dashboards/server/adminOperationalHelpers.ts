import type { AssignmentOfferStatus, BookingStateAuditRow, PaymentRow } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import { readAssignmentMetadata } from "@/features/assignments/server/assignmentMetadata";
import { isOfferOpenForOps } from "@/features/assignments/server/buildOfferExpiry";
import {
  ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING,
  ASSIGNMENT_RECOVERY_GRACE_MINUTES,
} from "@/features/assignments/server/constants";
import {
  isAssignmentRecoveryCandidate,
  isDispatchNotStartedAttentionReason,
} from "@/features/assignments/server/isAssignmentRecoveryCandidate";
import { computeDeferredDispatchNowEligible } from "@/features/assignments/server/deferredDispatchNowEligibility";
import { isDeferredDispatchFailureExempt } from "@/features/assignments/server/deferredDispatchStatus";
import {
  resolveAssignmentVisibility,
  type AssignmentVisibilityKey,
} from "@/features/assignments/server/resolveAssignmentVisibility";
import {
  labelForAssignmentAttention,
  labelForBookingStatus,
  labelForPaymentStatus,
} from "@/features/bookings/server/statusLabels";
import type { AdminRunbookKey } from "./adminRunbooks";
import type { AdminBookingListItem } from "./types";

export const ADMIN_BOOKINGS_LIST_LIMIT = 200;
export const ADMIN_ASSIGNMENT_QUEUE_LIMIT = 100;
export const ADMIN_HOME_PREVIEW_LIMIT = 5;

const SENSITIVE_METADATA_KEYS = new Set([
  "authorization",
  "secret",
  "token",
  "password",
  "card",
  "signature",
  "raw",
  "payload",
]);

export type AdminBookingFilter =
  | "payment_failed"
  | "pending_assignment"
  | "assignment_attention"
  | "dispatch_not_started"
  | "selected_declined"
  | "max_attempts"
  | "recovery_needed"
  | "two_cleaner_request"
  | "operational_load"
  | "team_awaiting_coordination"
  | "team_fully_coordinated"
  | "high_operational_load"
  | "team_high_risk_combo";

export type AdminBookingsQuery = {
  filter?: AdminBookingFilter;
  search?: string;
  scheduledFrom?: string;
  scheduledTo?: string;
};

export type AdminOperationsSummary = {
  assignmentAttentionTotal: number;
  paymentIssueTotal: number;
  recoveryNeededTotal: number;
  bookingsTotal: number;
  assignmentAttentionVisible: number;
  paymentIssueVisible: number;
  recoveryNeededVisible: number;
  bookingsVisible: number;
  bookingsListLimit: number;
  assignmentQueueLimit: number;
  homePreviewLimit: number;
};

export type AdminAuditEntry = {
  id: number;
  command: string | null;
  from: string | null;
  to: string | null;
  at: string;
  actorType: string | null;
  reason: string | null;
  idempotencyKey: string | null;
  metadataSummary: string | null;
  displayTitle: string | null;
  displayDescription: string | null;
};

export type RecoveryEligibility =
  | "eligible"
  | "grace_period"
  | "not_applicable"
  | "in_progress";

export type AdminOperationalStatus = {
  paymentState: string;
  assignmentState: string;
  recoveryEligibility: RecoveryEligibility;
  recoveryGraceMinutesRemaining: number | null;
  openOfferSummary: string;
  lastOfferOutcome: string | null;
  nextSuggestedAction: string;
  runbookKey: AdminRunbookKey | null;
  opsSearching: boolean;
  opsAdminRequired: boolean;
  recoveryCronCanHandle: boolean;
  manualInterventionNeeded: boolean;
  manualDispatchEligible: boolean;
  deferredDispatchNowEligible: boolean;
  replaceOfferEligible: boolean;
  openOfferForReplace: {
    offerId: string;
    cleanerId: string;
    cleanerName: string | null;
  } | null;
  dispatchOfferCount: number;
  maxDispatchAttemptsReached: boolean;
  queueReason: string | null;
};

/** True when admin may replace the single open offer (4C-a). */
export function computeReplaceOfferEligible(input: {
  bookingStatus: BookingStatus;
  hasAssignedCleaner: boolean;
  hasPaidPayment: boolean;
  openOfferCount: number;
}): boolean {
  if (input.bookingStatus !== "pending_assignment") return false;
  if (input.hasAssignedCleaner) return false;
  if (!input.hasPaidPayment) return false;
  return input.openOfferCount === 1;
}

/** True when admin may send a manual dispatch offer (4B-3a). */
export function computeManualDispatchEligible(input: {
  bookingStatus: BookingStatus;
  hasAssignedCleaner: boolean;
  hasPaidPayment: boolean;
  manualInterventionNeeded: boolean;
  openOfferCount: number;
}): boolean {
  if (input.bookingStatus !== "pending_assignment") return false;
  if (input.hasAssignedCleaner) return false;
  if (!input.hasPaidPayment) return false;
  if (input.openOfferCount > 0) return false;
  return input.manualInterventionNeeded;
}

export type AssignmentQueueOpsFields = {
  queueReason: string;
  opsSearching: boolean;
  opsAdminRequired: boolean;
  recoveryCronCanHandle: boolean;
  manualInterventionNeeded: boolean;
  runbookKey: AdminRunbookKey | null;
};

export function summarizeAuditMetadata(metadata: unknown): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_METADATA_KEYS.has(lower) || lower.includes("secret") || lower.includes("token")) {
      continue;
    }
    if (key === "failure_reason" && typeof value === "string") {
      parts.push(`failure_reason=${value}`);
      continue;
    }
    if (key === "assignment" && value != null && typeof value === "object") {
      const a = value as Record<string, unknown>;
      if (typeof a.status === "string") parts.push(`assignment.status=${a.status}`);
      if (typeof a.path === "string") parts.push(`assignment.path=${a.path}`);
      if (typeof a.reason === "string" && a.reason.length <= 120) {
        parts.push(`assignment.reason=${a.reason}`);
      }
      continue;
    }
    if (typeof value === "string" && value.length <= 80) {
      parts.push(`${key}=${value}`);
    } else if (typeof value === "number" || typeof value === "boolean") {
      parts.push(`${key}=${String(value)}`);
    }
  }
  return parts.length > 0 ? parts.join("; ") : null;
}

export function describeBookingStateAuditDisplay(row: BookingStateAuditRow): {
  displayTitle: string | null;
  displayDescription: string | null;
} {
  if (
    row.command === "RECORD_ASSIGNMENT_OFFER_EXPIRED" ||
    row.command === "EXPIRE_ASSIGNMENT_OFFER"
  ) {
    return {
      displayTitle: "Cleaner offer expired",
      displayDescription: "An assignment offer expired before the cleaner accepted.",
    };
  }
  return { displayTitle: null, displayDescription: null };
}

export function mapAuditRow(row: BookingStateAuditRow): AdminAuditEntry {
  const display = describeBookingStateAuditDisplay(row);
  return {
    id: row.id,
    command: row.command,
    from: row.from_status,
    to: row.to_status,
    at: row.created_at,
    actorType: row.actor_type ?? null,
    reason: row.reason?.trim() ? row.reason.trim() : null,
    idempotencyKey: row.idempotency_key ?? null,
    metadataSummary: summarizeAuditMetadata(row.metadata),
    displayTitle: display.displayTitle,
    displayDescription: display.displayDescription,
  };
}

export function computeDispatchNotStarted(input: {
  bookingStatus: BookingStatus;
  cleanerId: string | null;
  assignmentDispatchAt?: string | null;
  assignmentReason: string | null | undefined;
  payments: readonly Pick<PaymentRow, "status" | "updated_at" | "created_at">[];
  offers: readonly { status: string; expires_at: string | null }[];
  now?: Date;
  graceMinutes?: number;
}): boolean {
  if (
    isDeferredDispatchFailureExempt({
      assignmentDispatchAt: input.assignmentDispatchAt,
      now: input.now,
    })
  ) {
    return false;
  }

  return (
    isDispatchNotStartedAttentionReason(input.assignmentReason) ||
    isAssignmentRecoveryCandidate({
      booking: {
        status: input.bookingStatus,
        cleaner_id: input.cleanerId,
        assignment_dispatch_at: input.assignmentDispatchAt,
      },
      payments: input.payments,
      offers: input.offers,
      now: input.now,
      graceMinutes: input.graceMinutes ?? ASSIGNMENT_RECOVERY_GRACE_MINUTES,
    })
  );
}

export function computeRecoveryEligibility(input: {
  bookingStatus: BookingStatus;
  cleanerId: string | null;
  assignmentDispatchAt?: string | null;
  payments: readonly Pick<PaymentRow, "status" | "updated_at" | "created_at">[];
  offers: readonly { status: string; expires_at: string | null }[];
  hasOpenOffer: boolean;
  now?: Date;
  graceMinutes?: number;
}): { eligibility: RecoveryEligibility; graceMinutesRemaining: number | null } {
  const graceMinutes = input.graceMinutes ?? ASSIGNMENT_RECOVERY_GRACE_MINUTES;
  const now = input.now ?? new Date();

  if (input.bookingStatus !== "confirmed" || input.cleanerId) {
    return { eligibility: "not_applicable", graceMinutesRemaining: null };
  }

  if (
    isDeferredDispatchFailureExempt({
      assignmentDispatchAt: input.assignmentDispatchAt,
      now: input.now,
    })
  ) {
    return { eligibility: "not_applicable", graceMinutesRemaining: null };
  }

  const paidPayment = input.payments.find((p) => p.status === "paid");
  if (!paidPayment) {
    return { eligibility: "not_applicable", graceMinutesRemaining: null };
  }

  if (input.hasOpenOffer || input.offers.some((o) => o.status === "accepted")) {
    return { eligibility: "in_progress", graceMinutesRemaining: null };
  }

  if (
    isAssignmentRecoveryCandidate({
      booking: {
        status: input.bookingStatus,
        cleaner_id: input.cleanerId,
        assignment_dispatch_at: input.assignmentDispatchAt,
      },
      payments: input.payments,
      offers: input.offers,
      now,
      graceMinutes,
    })
  ) {
    return { eligibility: "eligible", graceMinutesRemaining: null };
  }

  const paidAtMs = new Date(paidPayment.updated_at || paidPayment.created_at).getTime();
  if (Number.isNaN(paidAtMs)) {
    return { eligibility: "not_applicable", graceMinutesRemaining: null };
  }

  const graceMs = graceMinutes * 60_000;
  const elapsed = now.getTime() - paidAtMs;
  if (elapsed < graceMs) {
    const remaining = Math.ceil((graceMs - elapsed) / 60_000);
    return { eligibility: "grace_period", graceMinutesRemaining: remaining };
  }

  return { eligibility: "not_applicable", graceMinutesRemaining: null };
}

function runbookForVisibilityKey(
  key: AssignmentVisibilityKey,
  paymentFailed: boolean,
): AdminRunbookKey | null {
  if (paymentFailed) return "paymentFailedRetry";
  switch (key) {
    case "dispatch_not_started":
      return "assignmentRecovery";
    case "decline_redispatched":
      return "assignmentDeclineRedispatch";
    case "selected_declined_admin":
    case "max_attempts_admin":
    case "needs_assignment":
      return "assignmentDeclineRedispatch";
    default:
      return null;
  }
}

export function buildAssignmentQueueOpsFields(input: {
  bookingStatus: BookingStatus;
  assignmentAttention: string;
  assignmentReason: string | null;
  dispatchNotStarted: boolean;
  visibilityKey: AssignmentVisibilityKey;
  opsSearching: boolean;
  opsAdminRequired: boolean;
}): AssignmentQueueOpsFields {
  const recoveryCronCanHandle = input.dispatchNotStarted;
  const manualInterventionNeeded =
    input.opsAdminRequired && !recoveryCronCanHandle;

  let queueReason: string;
  if (input.dispatchNotStarted) {
    queueReason =
      "Paid booking is still confirmed without assignment dispatch; recovery cron can re-run post-payment assignment after the grace window.";
  } else if (input.opsSearching) {
    queueReason =
      "System is actively searching or waiting on a cleaner offer — monitor; no admin action unless the offer expires or is declined.";
  } else if (input.assignmentAttention === "selected_declined_admin") {
    queueReason =
      "Customer selected a specific cleaner who declined; use manual dispatch on booking detail to offer another eligible cleaner.";
  } else if (input.assignmentAttention === "max_attempts_admin") {
    queueReason =
      "Maximum automatic dispatch attempts reached — use manual dispatch on booking detail with acknowledgement.";
  } else if (input.opsAdminRequired) {
    queueReason =
      "Assignment metadata requires admin review; see operational status on booking detail.";
  } else {
    queueReason = `Booking is ${labelForBookingStatus(input.bookingStatus).toLowerCase()} with assignment attention: ${labelForAssignmentAttention(input.assignmentAttention, input.assignmentReason)}.`;
  }

  return {
    queueReason,
    opsSearching: input.opsSearching,
    opsAdminRequired: input.opsAdminRequired,
    recoveryCronCanHandle,
    manualInterventionNeeded,
    runbookKey: runbookForVisibilityKey(
      input.visibilityKey,
      false,
    ),
  };
}

export function buildAdminOperationalStatus(input: {
  bookingStatus: BookingStatus;
  paymentStatus: string | null;
  paymentFailed: boolean;
  paymentFailureReason: string | null;
  visibilityKey: AssignmentVisibilityKey;
  assignmentReason: string | null;
  dispatchNotStarted: boolean;
  assignmentDispatchAt?: string | null;
  opsSearching: boolean;
  opsAdminRequired: boolean;
  openOfferCount: number;
  totalOfferCount: number;
  hasAssignedCleaner: boolean;
  hasPaidPayment: boolean;
  openOfferForReplace: {
    offerId: string;
    cleanerId: string;
    cleanerName: string | null;
  } | null;
  offerStatuses: readonly AssignmentOfferStatus[];
  lastOfferOutcome: string | null;
  recoveryEligibility: RecoveryEligibility;
  graceMinutesRemaining: number | null;
}): AdminOperationalStatus {
  const paymentState = input.paymentFailed
    ? `Payment failed${input.paymentFailureReason ? ` (${input.paymentFailureReason})` : ""}`
    : input.paymentStatus
      ? labelForPaymentStatus(input.paymentStatus as import("@/lib/database/types").PaymentStatus)
      : "No payment record";

  const assignmentState = input.visibilityKey
    ? labelForAssignmentAttention(input.visibilityKey, input.assignmentReason)
    : labelForBookingStatus(input.bookingStatus);

  const openCount = input.openOfferCount;
  const openOfferSummary =
    openCount === 0
      ? "No open offers"
      : `${openCount} open offer${openCount === 1 ? "" : "s"} — awaiting cleaner response`;

  const recoveryCronCanHandle = input.dispatchNotStarted;
  const manualInterventionNeeded =
    input.opsAdminRequired && !recoveryCronCanHandle && !input.opsSearching;

  let nextSuggestedAction: string;
  let runbookKey: AdminRunbookKey | null = runbookForVisibilityKey(
    input.visibilityKey,
    input.paymentFailed,
  );

  if (input.paymentFailed) {
    nextSuggestedAction =
      "Customer must retry payment from their booking page. Admin cannot finalize or retry payment here.";
  } else if (input.recoveryEligibility === "grace_period") {
    nextSuggestedAction = `Wait ${input.graceMinutesRemaining ?? ASSIGNMENT_RECOVERY_GRACE_MINUTES} minute(s) for post-payment dispatch to finish, then check again.`;
    runbookKey = "assignmentRecovery";
  } else if (input.recoveryEligibility === "eligible") {
    nextSuggestedAction =
      "Use Recover assignment below, or batch recovery via cron / ops script if many bookings are affected.";
    runbookKey = "assignmentRecovery";
  } else if (input.openOfferCount === 1) {
    nextSuggestedAction =
      "Use Replace open offer below to cancel the current offer and send a new one to an eligible cleaner.";
    runbookKey = runbookKey ?? "assignmentDeclineRedispatch";
  } else if (input.opsSearching) {
    nextSuggestedAction =
      "Monitor — system is dispatching or waiting on offer acceptance. Expiry/decline crons may redispatch automatically.";
    runbookKey = runbookKey ?? "expireAssignmentOffers";
  } else if (input.visibilityKey === "selected_declined_admin") {
    nextSuggestedAction =
      "Use Send offer to cleaner below to offer an eligible cleaner. The cleaner must accept before the booking is assigned.";
    runbookKey = "assignmentDeclineRedispatch";
  } else if (input.visibilityKey === "max_attempts_admin") {
    nextSuggestedAction =
      "Use Send offer to cleaner below (acknowledge max attempts). The cleaner must accept before the booking is assigned.";
    runbookKey = "assignmentDeclineRedispatch";
  } else if (input.bookingStatus === "completed") {
    nextSuggestedAction = "Use payout actions below when earnings are ready.";
    runbookKey = "adminDashboard";
  } else {
    nextSuggestedAction = "No immediate admin action — booking is progressing normally.";
  }

  const queueFields = buildAssignmentQueueOpsFields({
    bookingStatus: input.bookingStatus,
    assignmentAttention: input.visibilityKey ?? "needs_assignment",
    assignmentReason: input.assignmentReason,
    dispatchNotStarted: input.dispatchNotStarted,
    visibilityKey: input.visibilityKey,
    opsSearching: input.opsSearching,
    opsAdminRequired: input.opsAdminRequired,
  });

  const replaceOfferEligible = computeReplaceOfferEligible({
    bookingStatus: input.bookingStatus,
    hasAssignedCleaner: input.hasAssignedCleaner,
    hasPaidPayment: input.hasPaidPayment,
    openOfferCount: input.openOfferCount,
  });
  const manualDispatchEligible =
    !replaceOfferEligible &&
    computeManualDispatchEligible({
      bookingStatus: input.bookingStatus,
      hasAssignedCleaner: input.hasAssignedCleaner,
      hasPaidPayment: input.hasPaidPayment,
      manualInterventionNeeded,
      openOfferCount: input.openOfferCount,
    });
  const deferredDispatchNowEligible =
    !replaceOfferEligible &&
    computeDeferredDispatchNowEligible({
      bookingStatus: input.bookingStatus,
      hasAssignedCleaner: input.hasAssignedCleaner,
      hasPaidPayment: input.hasPaidPayment,
      assignmentDispatchAt: input.assignmentDispatchAt ?? null,
      openOfferCount: input.openOfferCount,
    });
  const maxDispatchAttemptsReached =
    input.totalOfferCount >= ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING;

  return {
    paymentState,
    assignmentState,
    recoveryEligibility: input.recoveryEligibility,
    recoveryGraceMinutesRemaining: input.graceMinutesRemaining,
    openOfferSummary,
    lastOfferOutcome: input.lastOfferOutcome,
    nextSuggestedAction,
    runbookKey,
    opsSearching: input.opsSearching,
    opsAdminRequired: input.opsAdminRequired,
    recoveryCronCanHandle,
    manualInterventionNeeded,
    manualDispatchEligible,
    deferredDispatchNowEligible,
    replaceOfferEligible,
    openOfferForReplace: input.openOfferForReplace,
    dispatchOfferCount: input.totalOfferCount,
    maxDispatchAttemptsReached,
    queueReason: queueFields.queueReason,
  };
}

export function matchesAdminBookingFilter(
  item: Pick<
    AdminBookingListItem,
    "status" | "assignmentVisibilityKey" | "assignmentAttention" | "paymentFailureReason"
  > & {
    observation?: AdminBookingListItem["observation"];
    dispatchNotStarted?: boolean;
    recoveryEligible?: boolean;
  },
  filter: AdminBookingFilter,
): boolean {
  const key = item.assignmentVisibilityKey;
  switch (filter) {
    case "payment_failed":
      return item.status === "payment_failed";
    case "pending_assignment":
      return item.status === "pending_assignment";
    case "assignment_attention":
      return (
        key === "needs_assignment" ||
        key === "selected_declined_admin" ||
        key === "max_attempts_admin" ||
        item.assignmentAttention === "attention_required"
      );
    case "dispatch_not_started":
      return key === "dispatch_not_started" || item.dispatchNotStarted === true;
    case "selected_declined":
      return key === "selected_declined_admin";
    case "max_attempts":
      return key === "max_attempts_admin";
    case "recovery_needed":
      return item.recoveryEligible === true || key === "dispatch_not_started";
    case "two_cleaner_request":
      return item.observation?.isTwoCleanerRequest === true;
    case "operational_load":
      return (item.observation?.operationalLoad.operationalLoadScore ?? 0) >= 2;
    case "team_awaiting_coordination":
      if (!item.observation?.isTwoCleanerRequest) return false;
      return (
        item.observation.teamSupportOps.coordinationStatus?.status ===
          "awaiting_coordination" || item.observation.teamSupportOps.coordinationStatus == null
      );
    case "team_fully_coordinated":
      return (
        item.observation?.isTwoCleanerRequest === true &&
        item.observation.teamSupportOps.coordinationStatus?.status === "fully_coordinated"
      );
    case "high_operational_load":
      return (item.observation?.operationalLoad.operationalLoadScore ?? 0) >= 3;
    case "team_high_risk_combo":
      return (
        item.observation?.isTwoCleanerRequest === true &&
        item.observation.operationalLoad.isShaleanEquipment === true &&
        item.observation.operationalLoad.isHeavyIntensity === true
      );
    default:
      return true;
  }
}

export function filterAdminBookings(
  items: (AdminBookingListItem & {
    dispatchNotStarted?: boolean;
    recoveryEligible?: boolean;
    scheduledStart?: string;
    searchText?: string;
  })[],
  query: AdminBookingsQuery,
): AdminBookingListItem[] {
  let filtered = items;

  if (query.filter) {
    filtered = filtered.filter((item) => matchesAdminBookingFilter(item, query.filter!));
  }

  if (query.search?.trim()) {
    const q = query.search.trim().toLowerCase();
    filtered = filtered.filter((item) => item.searchText?.toLowerCase().includes(q));
  }

  if (query.scheduledFrom) {
    const fromMs = new Date(query.scheduledFrom).getTime();
    filtered = filtered.filter((item) => {
      if (!item.scheduledStart) return true;
      return new Date(item.scheduledStart).getTime() >= fromMs;
    });
  }

  if (query.scheduledTo) {
    const toMs = new Date(query.scheduledTo).getTime();
    filtered = filtered.filter((item) => {
      if (!item.scheduledStart) return true;
      return new Date(item.scheduledStart).getTime() <= toMs;
    });
  }

  return filtered;
}

export function computeAdminOperationsSummary(input: {
  bookings: (AdminBookingListItem & {
    dispatchNotStarted?: boolean;
    recoveryEligible?: boolean;
  })[];
  assignmentQueueTotal: number;
  bookingsVisible: number;
  assignmentQueueVisible: number;
}): AdminOperationsSummary {
  const paymentIssueTotal = input.bookings.filter((b) => b.status === "payment_failed").length;
  const recoveryNeededTotal = input.bookings.filter(
    (b) => b.recoveryEligible || b.assignmentVisibilityKey === "dispatch_not_started",
  ).length;
  const assignmentAttentionTotal = input.assignmentQueueTotal;

  const paymentIssueVisible = input.bookings
    .slice(0, input.bookingsVisible)
    .filter((b) => b.status === "payment_failed").length;

  return {
    assignmentAttentionTotal,
    paymentIssueTotal,
    recoveryNeededTotal,
    bookingsTotal: input.bookings.length,
    assignmentAttentionVisible: Math.min(
      input.assignmentQueueVisible,
      assignmentAttentionTotal,
    ),
    paymentIssueVisible,
    recoveryNeededVisible: Math.min(
      input.bookingsVisible,
      recoveryNeededTotal,
    ),
    bookingsVisible: input.bookingsVisible,
    bookingsListLimit: ADMIN_BOOKINGS_LIST_LIMIT,
    assignmentQueueLimit: ADMIN_ASSIGNMENT_QUEUE_LIMIT,
    homePreviewLimit: ADMIN_HOME_PREVIEW_LIMIT,
  };
}

export function resolveVisibilityForBooking(input: {
  bookingStatus: BookingStatus;
  metadata: import("@/lib/database/types").Json | null | undefined;
  hasOpenOffer: boolean;
  offerStatuses: readonly AssignmentOfferStatus[];
  dispatchNotStarted: boolean;
}) {
  return resolveAssignmentVisibility({
    bookingStatus: input.bookingStatus,
    metadata: input.metadata,
    hasOpenOffer: input.hasOpenOffer,
    offerStatuses: input.offerStatuses,
    dispatchNotStarted: input.dispatchNotStarted,
  });
}

export function buildSearchText(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}
