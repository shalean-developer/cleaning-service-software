import type { AssignmentOfferStatus } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import { readAssignmentMetadata } from "./assignmentMetadata";
import { isDispatchNotStartedAttentionReason } from "./isAssignmentRecoveryCandidate";
import type { AssignmentMetadata, AssignmentPath, LastOfferOutcome } from "./types";
import type { Json } from "@/lib/database/types";

/** Keys used by admin badges and read models (not raw DB status). */
export type AssignmentVisibilityKey =
  | "dispatch_not_started"
  | "decline_redispatched"
  | "finding_cleaner"
  | "offer_sent"
  | "selected_expired_admin"
  | "selected_declined_admin"
  | "max_attempts_admin"
  | "needs_assignment"
  | null;

export type AssignmentVisibility = {
  key: AssignmentVisibilityKey;
  adminLabel: string;
  customerMessage: string | null;
  /** When false, customer UI must not show generic "Needs assignment" warning. */
  showCustomerAssignmentWarning: boolean;
  lastOfferOutcome: LastOfferOutcome | null;
  opsSearching: boolean;
  opsAdminRequired: boolean;
};

function isRedispatchEligiblePath(path: AssignmentPath | null): boolean {
  return path === "best_available" || path === "fallback_best_available" || path === null;
}

export function inferLastOfferOutcome(
  assignment: AssignmentMetadata | null,
  offerStatuses: readonly AssignmentOfferStatus[],
  reason: string | null,
): LastOfferOutcome | null {
  if (assignment?.lastOfferOutcome) return assignment.lastOfferOutcome;

  const reasonLower = reason?.toLowerCase() ?? "";
  if (reasonLower.includes("declined")) return "declined";
  if (reasonLower.includes("expired")) return "expired";

  if (offerStatuses.includes("declined")) return "declined";
  if (offerStatuses.includes("expired")) return "expired";
  if (offerStatuses.includes("cancelled")) return "cancelled";

  return null;
}

function isMaxAttemptsReason(reason: string | null): boolean {
  return (
    typeof reason === "string" &&
    reason.toLowerCase().includes("maximum assignment dispatch attempts")
  );
}

export function resolveAssignmentVisibility(input: {
  bookingStatus: BookingStatus;
  metadata: Json | null | undefined;
  hasOpenOffer?: boolean;
  offerStatuses?: readonly AssignmentOfferStatus[];
  dispatchNotStarted?: boolean;
}): AssignmentVisibility {
  const assignment = readAssignmentMetadata(input.metadata);
  const reason = assignment?.reason ?? null;
  const path = assignment?.path ?? null;
  const offerStatuses = input.offerStatuses ?? [];
  const hasOpenOffer = input.hasOpenOffer ?? false;
  const hasDeclinedOffer = offerStatuses.includes("declined");
  const lastOfferOutcome = inferLastOfferOutcome(assignment, offerStatuses, reason);

  if (assignment?.status === "deferred") {
    return {
      key: null,
      adminLabel: "Awaiting dispatch window",
      customerMessage: null,
      showCustomerAssignmentWarning: false,
      lastOfferOutcome,
      opsSearching: false,
      opsAdminRequired: false,
    };
  }

  if (input.dispatchNotStarted || isDispatchNotStartedAttentionReason(reason)) {
    return {
      key: "dispatch_not_started",
      adminLabel: "Paid — dispatch not started",
      customerMessage: null,
      showCustomerAssignmentWarning: false,
      lastOfferOutcome,
      opsSearching: false,
      opsAdminRequired: true,
    };
  }

  if (input.bookingStatus !== "pending_assignment") {
    return {
      key: null,
      adminLabel: "",
      customerMessage: null,
      showCustomerAssignmentWarning: false,
      lastOfferOutcome,
      opsSearching: false,
      opsAdminRequired: false,
    };
  }

  if (
    hasOpenOffer &&
    hasDeclinedOffer &&
    isRedispatchEligiblePath(path) &&
    assignment?.status === "offered"
  ) {
    return {
      key: "decline_redispatched",
      adminLabel: "Cleaner declined — redispatched",
      customerMessage: "We're finding another available cleaner.",
      showCustomerAssignmentWarning: false,
      lastOfferOutcome: "declined",
      opsSearching: true,
      opsAdminRequired: false,
    };
  }

  if (hasOpenOffer && assignment?.status === "offered") {
    return {
      key: "offer_sent",
      adminLabel: "Offer sent — awaiting acceptance",
      customerMessage: null,
      showCustomerAssignmentWarning: false,
      lastOfferOutcome,
      opsSearching: true,
      opsAdminRequired: false,
    };
  }

  if (hasOpenOffer) {
    return {
      key: "finding_cleaner",
      adminLabel: "Finding cleaner",
      customerMessage: "We're finding another available cleaner.",
      showCustomerAssignmentWarning: false,
      lastOfferOutcome,
      opsSearching: true,
      opsAdminRequired: false,
    };
  }

  if (isMaxAttemptsReason(reason)) {
    return {
      key: "max_attempts_admin",
      adminLabel: "No cleaner accepted after dispatch attempts",
      customerMessage: "We're reviewing cleaner availability for your booking.",
      showCustomerAssignmentWarning: true,
      lastOfferOutcome,
      opsSearching: false,
      opsAdminRequired: true,
    };
  }

  if (
    assignment?.status === "attention_required" &&
    path === "selected" &&
    (lastOfferOutcome === "expired" ||
      (typeof reason === "string" && reason.toLowerCase().includes("expired")))
  ) {
    return {
      key: "selected_expired_admin",
      adminLabel: "Selected cleaner offer expired — admin action needed",
      customerMessage: "We're reviewing cleaner availability for your booking.",
      showCustomerAssignmentWarning: true,
      lastOfferOutcome: "expired",
      opsSearching: false,
      opsAdminRequired: true,
    };
  }

  if (
    assignment?.status === "attention_required" &&
    path === "selected" &&
    (lastOfferOutcome === "declined" ||
      (typeof reason === "string" && reason.toLowerCase().includes("declined")))
  ) {
    return {
      key: "selected_declined_admin",
      adminLabel: "Selected cleaner declined — admin action needed",
      customerMessage: "We're reviewing cleaner availability for your booking.",
      showCustomerAssignmentWarning: true,
      lastOfferOutcome: "declined",
      opsSearching: false,
      opsAdminRequired: true,
    };
  }

  if (assignment?.status === "attention_required") {
    return {
      key: "needs_assignment",
      adminLabel: "Needs assignment",
      customerMessage: "We're reviewing cleaner availability for your booking.",
      showCustomerAssignmentWarning: true,
      lastOfferOutcome,
      opsSearching: false,
      opsAdminRequired: true,
    };
  }

  return {
    key: "finding_cleaner",
    adminLabel: "Finding cleaner",
    customerMessage: null,
    showCustomerAssignmentWarning: false,
    lastOfferOutcome,
    opsSearching: true,
    opsAdminRequired: false,
  };
}
