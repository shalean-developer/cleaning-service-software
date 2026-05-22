import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database/types";
import type { RecordAdminDeleteAuditInput } from "./types";

export async function recordAdminDeleteAudit(
  client: SupabaseClient<Database>,
  input: RecordAdminDeleteAuditInput,
): Promise<string | null> {
  const idempotencyKey =
    input.outcome === "success" || input.outcome === "idempotent"
      ? input.idempotencyKey?.trim() || null
      : null;

  const { data, error } = await client
    .from("admin_delete_audit")
    .insert({
      entity_type: input.entityType,
      entity_id: input.entityId,
      admin_profile_id: input.adminProfileId,
      action: input.action,
      reason: input.reason?.trim() ? input.reason.trim() : null,
      blocked_reason: input.blockedReason?.trim() ? input.blockedReason.trim() : null,
      outcome: input.outcome,
      metadata: (input.metadata ?? {}) as Json,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" && idempotencyKey) {
      const { data: existing } = await client
        .from("admin_delete_audit")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      return existing?.id ?? null;
    }
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

export async function findAdminDeleteAuditByIdempotencyKey(
  client: SupabaseClient<Database>,
  idempotencyKey: string,
): Promise<{ id: string; outcome: string } | null> {
  const { data, error } = await client
    .from("admin_delete_audit")
    .select("id, outcome")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
