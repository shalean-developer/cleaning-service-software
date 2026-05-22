import "server-only";

export const ADMIN_DELETE_ENTITY_TYPES = ["booking", "customer", "cleaner"] as const;
export type AdminDeleteEntityType = (typeof ADMIN_DELETE_ENTITY_TYPES)[number];

export const ADMIN_DELETE_ACTIONS = ["archive", "delete", "hard_delete"] as const;
export type AdminDeleteAction = (typeof ADMIN_DELETE_ACTIONS)[number];

export const ADMIN_DELETE_OUTCOMES = [
  "success",
  "rejected",
  "idempotent",
  "failed",
] as const;
export type AdminDeleteOutcome = (typeof ADMIN_DELETE_OUTCOMES)[number];

export type AdminArchiveCommandSuccess = {
  ok: true;
  outcome: "success" | "idempotent";
  entityType: AdminDeleteEntityType;
  entityId: string;
  auditId: string | null;
  message: string;
  affectedCounts?: Record<string, number>;
};

export type AdminArchiveCommandFailure = {
  ok: false;
  outcome: "rejected" | "failed";
  entityType: AdminDeleteEntityType;
  entityId: string;
  code: string;
  message: string;
  auditId: string | null;
  blockedReason?: string | null;
  affectedCounts?: Record<string, number>;
};

export type AdminArchiveCommandResult =
  | AdminArchiveCommandSuccess
  | AdminArchiveCommandFailure;

export type RecordAdminDeleteAuditInput = {
  entityType: AdminDeleteEntityType;
  entityId: string;
  adminProfileId: string;
  action: AdminDeleteAction;
  outcome: AdminDeleteOutcome;
  reason?: string | null;
  blockedReason?: string | null;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string | null;
};
