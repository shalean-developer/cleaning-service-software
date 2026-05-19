import type { Json } from "@/lib/database/types";

export const CLEANER_LIFECYCLE_AUDIT_ACTIONS = [
  "deactivated",
  "suspended",
  "reactivated",
  "unsuspended",
  "archived",
  "open_offers_cancelled",
  "onboarding_completed",
] as const;

export type CleanerLifecycleAuditAction = (typeof CLEANER_LIFECYCLE_AUDIT_ACTIONS)[number];

export const CLEANER_LIFECYCLE_OUTCOMES = [
  "success",
  "idempotent",
  "rejected",
  "failed",
] as const;

export type CleanerLifecycleOutcome = (typeof CLEANER_LIFECYCLE_OUTCOMES)[number];

/** Serialized cleaner row fields stored in cleaner_operational_audit before/after_state. */
export type CleanerLifecycleStateJson = {
  active: boolean;
  suspended_at: string | null;
  suspension_ends_at: string | null;
  deleted_at: string | null;
  onboarding_completed_at: string | null;
  lifecycle_reason: string | null;
};

export type CleanerLifecycleAffectedCounts = {
  openOffersCancelled: number;
  activeBookingsFound: number;
  pendingEarningsFound: number;
};

export type CleanerLifecycleCommandSuccess = {
  ok: true;
  outcome: Extract<CleanerLifecycleOutcome, "success" | "idempotent">;
  cleanerId: string;
  auditId: string | null;
  beforeState: CleanerLifecycleStateJson;
  afterState: CleanerLifecycleStateJson;
  affectedCounts: CleanerLifecycleAffectedCounts;
  message: string;
};

export type CleanerLifecycleCommandFailure = {
  ok: false;
  outcome: Extract<CleanerLifecycleOutcome, "rejected" | "failed">;
  cleanerId: string;
  code: string;
  message: string;
  auditId: string | null;
  beforeState?: CleanerLifecycleStateJson;
  afterState?: CleanerLifecycleStateJson;
  affectedCounts?: CleanerLifecycleAffectedCounts;
};

export type CleanerLifecycleCommandResult =
  | CleanerLifecycleCommandSuccess
  | CleanerLifecycleCommandFailure;

export type CleanerLifecycleBaseParams = {
  cleanerId: string;
  adminProfileId: string;
  idempotencyKey?: string | null;
  /** Persisted to cleaners.lifecycle_reason when the row is updated. */
  lifecycleReason?: string | null;
};

export type DeactivateCleanerParams = CleanerLifecycleBaseParams & {
  reason: string;
};

export type SuspendCleanerParams = CleanerLifecycleBaseParams & {
  reason: string;
  suspensionEndsAt?: string | null;
};

export type ReactivateCleanerParams = CleanerLifecycleBaseParams;

export type UnsuspendCleanerParams = CleanerLifecycleBaseParams & {
  /** When true, sets active = true after clearing suspension fields. */
  setActive?: boolean;
};

export type ArchiveCleanerParams = CleanerLifecycleBaseParams & {
  reason: string;
};

export type CancelCleanerOpenOffersParams = CleanerLifecycleBaseParams & {
  reason?: string | null;
};

export type CompleteCleanerOnboardingParams = CleanerLifecycleBaseParams;

export type RecordCleanerOperationalAuditInput = {
  cleanerId: string;
  adminProfileId: string;
  action: CleanerLifecycleAuditAction;
  outcome: CleanerLifecycleOutcome;
  reason?: string | null;
  beforeState: CleanerLifecycleStateJson;
  afterState: CleanerLifecycleStateJson;
  affectedCounts: CleanerLifecycleAffectedCounts;
  idempotencyKey?: string | null;
  metadata?: Json;
};
