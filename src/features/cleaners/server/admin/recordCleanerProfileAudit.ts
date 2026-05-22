import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/database/types";
import type { Database } from "@/lib/database/types";
import { emptyAffectedCounts } from "../lifecycle/lifecycleCommandSupport";
import type { CleanerLifecycleStateJson } from "../lifecycle/types";

export const CLEANER_PROFILE_AUDIT_ACTIONS = [
  "profile_created",
  "profile_create_failed",
  "profile_updated",
] as const;

export type CleanerProfileAuditAction = (typeof CLEANER_PROFILE_AUDIT_ACTIONS)[number];

const EMPTY_LIFECYCLE_STATE: CleanerLifecycleStateJson = {
  active: false,
  suspended_at: null,
  suspension_ends_at: null,
  deleted_at: null,
  onboarding_completed_at: null,
  lifecycle_reason: null,
};

export type RecordCleanerProfileAuditInput = {
  cleanerId: string;
  adminProfileId: string;
  action: CleanerProfileAuditAction;
  outcome: "success" | "failed";
  reason?: string | null;
  metadata: Json;
  idempotencyKey?: string | null;
};

export async function recordCleanerProfileAudit(
  client: SupabaseClient<Database>,
  input: RecordCleanerProfileAuditInput,
): Promise<string | null> {
  const idempotencyKey =
    input.outcome === "success" && input.idempotencyKey?.trim()
      ? input.idempotencyKey.trim()
      : null;

  const { data, error } = await client
    .from("cleaner_operational_audit")
    .insert({
      cleaner_id: input.cleanerId,
      admin_profile_id: input.adminProfileId,
      action: input.action,
      outcome: input.outcome,
      reason: input.reason?.trim() ? input.reason.trim() : null,
      before_state: EMPTY_LIFECYCLE_STATE,
      after_state: EMPTY_LIFECYCLE_STATE,
      affected_counts: emptyAffectedCounts(),
      metadata: input.metadata,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" && idempotencyKey) {
      const { data: existing } = await client
        .from("cleaner_operational_audit")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      return existing?.id ?? null;
    }
    throw new Error(error.message);
  }

  return data?.id ?? null;
}
