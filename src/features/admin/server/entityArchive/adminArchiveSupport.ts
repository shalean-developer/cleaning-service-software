import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  findAdminDeleteAuditByIdempotencyKey,
  recordAdminDeleteAudit,
} from "./recordAdminDeleteAudit";
import type {
  AdminArchiveCommandFailure,
  AdminArchiveCommandResult,
  AdminArchiveCommandSuccess,
  AdminDeleteAction,
  AdminDeleteEntityType,
  RecordAdminDeleteAuditInput,
} from "./types";

export function buildAdminArchiveIdempotencyKey(
  entityType: AdminDeleteEntityType,
  action: AdminDeleteAction,
  entityId: string,
  adminProfileId: string,
  customKey?: string | null,
): string {
  if (customKey?.trim()) return customKey.trim();
  return `admin-archive:${entityType}:${action}:${entityId}:${adminProfileId}`;
}

export function requireNonEmptyArchiveReason(
  reason: string | undefined | null,
  label: string,
): string | null {
  const trimmed = reason?.trim();
  if (!trimmed) return `${label} requires a non-empty reason.`;
  return null;
}

function successResult(
  input: Omit<AdminArchiveCommandSuccess, "ok">,
): AdminArchiveCommandSuccess {
  return { ok: true, ...input };
}

function failureResult(
  input: Omit<AdminArchiveCommandFailure, "ok">,
): AdminArchiveCommandFailure {
  return { ok: false, ...input };
}

export async function finalizeAdminArchiveCommand(
  client: SupabaseClient<Database>,
  input: RecordAdminDeleteAuditInput & {
    entityId: string;
    code?: string;
    message: string;
    affectedCounts?: Record<string, number>;
  },
): Promise<AdminArchiveCommandResult> {
  let auditId: string | null = null;
  try {
    auditId = await recordAdminDeleteAudit(client, input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit persist failed.";
    return failureResult({
      outcome: "failed",
      entityType: input.entityType,
      entityId: input.entityId,
      code: "AUDIT_PERSISTENCE_ERROR",
      message,
      auditId: null,
      blockedReason: input.blockedReason,
      affectedCounts: input.affectedCounts,
    });
  }

  if (input.outcome === "rejected" || input.outcome === "failed") {
    return failureResult({
      outcome: input.outcome,
      entityType: input.entityType,
      entityId: input.entityId,
      code: input.code ?? "REJECTED",
      message: input.message,
      auditId,
      blockedReason: input.blockedReason,
      affectedCounts: input.affectedCounts,
    });
  }

  return successResult({
    outcome: input.outcome === "idempotent" ? "idempotent" : "success",
    entityType: input.entityType,
    entityId: input.entityId,
    auditId,
    message: input.message,
    affectedCounts: input.affectedCounts,
  });
}

export async function resolveIdempotentAdminArchiveReplay(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
  entityType: AdminDeleteEntityType,
  entityId: string,
): Promise<AdminArchiveCommandSuccess | null> {
  const existing = await findAdminDeleteAuditByIdempotencyKey(client, idempotencyKey);
  if (!existing || (existing.outcome !== "success" && existing.outcome !== "idempotent")) {
    return null;
  }
  return successResult({
    outcome: "idempotent",
    entityType,
    entityId,
    auditId: existing.id,
    message: "Archive command already applied (idempotent replay).",
  });
}

export function mapAdminArchiveHttpStatus(result: AdminArchiveCommandResult): number {
  if (result.ok) return 200;
  switch (result.code) {
    case "INVALID_PAYLOAD":
      return 400;
    case "BOOKING_NOT_FOUND":
    case "CUSTOMER_NOT_FOUND":
    case "CLEANER_NOT_FOUND":
      return 404;
    case "PAYMENT_HISTORY_BLOCK":
    case "ACTIVE_ASSIGNMENT_BLOCK":
    case "ACTIVE_BOOKINGS_BLOCK":
    case "CLEANER_MUST_DEACTIVATE_FIRST":
    case "CLEANER_ARCHIVED":
    case "CUSTOMER_ALREADY_ARCHIVED":
    case "BOOKING_ALREADY_ARCHIVED":
    case "HARD_DELETE_NOT_ALLOWED":
      return 409;
    default:
      return 500;
  }
}
