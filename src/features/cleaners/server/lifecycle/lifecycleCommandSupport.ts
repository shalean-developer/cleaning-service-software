import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CleanerRow, Database } from "@/lib/database/types";
import { isCleanerSuspended } from "@/features/cleaners/server/eligibility/evaluate";
import { enableCleanerLifecycleColumnWrite } from "./enableLifecycleColumnWrite";
import { cleanerRowToLifecycleState } from "./lifecycleStateSnapshot";
import {
  countActiveBookingsForCleaner,
  countPendingEarningsForCleaner,
} from "./lifecycleQueries";
import type {
  CleanerLifecycleAffectedCounts,
  CleanerLifecycleAuditAction,
  CleanerLifecycleCommandFailure,
  CleanerLifecycleCommandResult,
  CleanerLifecycleCommandSuccess,
  CleanerLifecycleOutcome,
  CleanerLifecycleStateJson,
  RecordCleanerOperationalAuditInput,
} from "./types";
import {
  findCleanerLifecycleAuditByIdempotencyKey,
  recordCleanerOperationalAudit,
} from "./recordCleanerOperationalAudit";

export function emptyAffectedCounts(): CleanerLifecycleAffectedCounts {
  return {
    openOffersCancelled: 0,
    activeBookingsFound: 0,
    pendingEarningsFound: 0,
  };
}

export function buildLifecycleIdempotencyKey(
  action: CleanerLifecycleAuditAction,
  cleanerId: string,
  adminProfileId: string,
  customKey?: string | null,
): string {
  if (customKey?.trim()) return customKey.trim();
  return `cleaner-lifecycle:${action}:${cleanerId}:${adminProfileId}`;
}

export async function loadCleanerRow(
  client: SupabaseClient<Database>,
  cleanerId: string,
): Promise<CleanerRow | null> {
  const { data, error } = await client
    .from("cleaners")
    .select("*")
    .eq("id", cleanerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCleanerLifecycleRow(
  client: SupabaseClient<Database>,
  cleanerId: string,
  patch: Partial<
    Pick<
      CleanerRow,
      | "active"
      | "suspended_at"
      | "suspension_ends_at"
      | "deleted_at"
      | "onboarding_completed_at"
      | "lifecycle_reason"
    >
  >,
): Promise<CleanerRow> {
  await enableCleanerLifecycleColumnWrite(client);
  const { data, error } = await client
    .from("cleaners")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", cleanerId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

function successResult(
  input: Omit<CleanerLifecycleCommandSuccess, "ok" | "outcome"> & {
    outcome?: CleanerLifecycleCommandSuccess["outcome"];
  },
): CleanerLifecycleCommandSuccess {
  return {
    ok: true,
    outcome: input.outcome ?? "success",
    cleanerId: input.cleanerId,
    auditId: input.auditId,
    beforeState: input.beforeState,
    afterState: input.afterState,
    affectedCounts: input.affectedCounts,
    message: input.message,
  };
}

function failureResult(
  input: Omit<CleanerLifecycleCommandFailure, "ok">,
): CleanerLifecycleCommandFailure {
  return { ok: false, ...input };
}

export async function finalizeLifecycleCommand(
  client: SupabaseClient<Database>,
  input: {
    cleanerId: string;
    adminProfileId: string;
    action: CleanerLifecycleAuditAction;
    outcome: CleanerLifecycleOutcome;
    reason?: string | null;
    beforeState: CleanerLifecycleStateJson;
    afterState: CleanerLifecycleStateJson;
    affectedCounts: CleanerLifecycleAffectedCounts;
    idempotencyKey?: string | null;
    code?: string;
    message: string;
  },
): Promise<CleanerLifecycleCommandResult> {
  const auditInput: RecordCleanerOperationalAuditInput = {
    cleanerId: input.cleanerId,
    adminProfileId: input.adminProfileId,
    action: input.action,
    outcome: input.outcome,
    reason: input.reason,
    beforeState: input.beforeState,
    afterState: input.afterState,
    affectedCounts: input.affectedCounts,
    idempotencyKey: input.idempotencyKey,
  };

  let auditId: string | null = null;
  try {
    auditId = await recordCleanerOperationalAudit(client, auditInput);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit persist failed.";
    return failureResult({
      outcome: "failed",
      cleanerId: input.cleanerId,
      code: "AUDIT_PERSISTENCE_ERROR",
      message,
      auditId: null,
      beforeState: input.beforeState,
      afterState: input.afterState,
      affectedCounts: input.affectedCounts,
    });
  }

  if (input.outcome === "rejected" || input.outcome === "failed") {
    return failureResult({
      outcome: input.outcome,
      cleanerId: input.cleanerId,
      code: input.code ?? "REJECTED",
      message: input.message,
      auditId,
      beforeState: input.beforeState,
      afterState: input.afterState,
      affectedCounts: input.affectedCounts,
    });
  }

  return successResult({
    outcome: input.outcome,
    cleanerId: input.cleanerId,
    auditId,
    beforeState: input.beforeState,
    afterState: input.afterState,
    affectedCounts: input.affectedCounts,
    message: input.message,
  });
}

export async function resolveIdempotentLifecycleReplay(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
  cleanerId: string,
  beforeState: CleanerLifecycleStateJson,
): Promise<CleanerLifecycleCommandSuccess | null> {
  const existing = await findCleanerLifecycleAuditByIdempotencyKey(client, idempotencyKey);
  if (!existing || (existing.outcome !== "success" && existing.outcome !== "idempotent")) {
    return null;
  }
  return successResult({
    outcome: "idempotent",
    cleanerId,
    auditId: existing.id,
    beforeState,
    afterState: beforeState,
    affectedCounts: emptyAffectedCounts(),
    message: "Lifecycle command already applied (idempotent replay).",
  });
}

export function requireNonEmptyReason(
  reason: string | undefined | null,
  actionLabel: string,
): string | null {
  const trimmed = reason?.trim();
  if (!trimmed) return `${actionLabel} requires a non-empty reason.`;
  return null;
}

export function isCleanerArchived(row: CleanerRow): boolean {
  return row.deleted_at != null;
}

export function isCleanerSuspendedNow(row: CleanerRow, now: Date = new Date()): boolean {
  return isCleanerSuspended(row.suspended_at, now);
}

export async function gatherLifecycleAffectedCounts(
  client: SupabaseClient<Database>,
  cleanerId: string,
  openOffersCancelled: number,
): Promise<CleanerLifecycleAffectedCounts> {
  const [activeBookingsFound, pendingEarningsFound] = await Promise.all([
    countActiveBookingsForCleaner(client, cleanerId),
    countPendingEarningsForCleaner(client, cleanerId),
  ]);
  return {
    openOffersCancelled,
    activeBookingsFound,
    pendingEarningsFound,
  };
}

export { cleanerRowToLifecycleState };
