import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import type { RecordCleanerOperationalAuditInput } from "./types";

function shouldAttachIdempotencyKey(
  outcome: RecordCleanerOperationalAuditInput["outcome"],
): boolean {
  return outcome === "success" || outcome === "idempotent";
}

export async function recordCleanerOperationalAudit(
  client: SupabaseClient<Database>,
  input: RecordCleanerOperationalAuditInput,
): Promise<string | null> {
  const idempotencyKey =
    input.idempotencyKey && shouldAttachIdempotencyKey(input.outcome)
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
      before_state: input.beforeState,
      after_state: input.afterState,
      affected_counts: input.affectedCounts,
      metadata: input.metadata ?? {},
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

export async function findCleanerLifecycleAuditByIdempotencyKey(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<{ id: string; outcome: string } | null> {
  const { data, error } = await client
    .from("cleaner_operational_audit")
    .select("id, outcome")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
