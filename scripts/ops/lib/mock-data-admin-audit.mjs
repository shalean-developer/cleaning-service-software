const OPS_ACTOR_REASON = "ops_mock_data_purge";

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function resolveOpsAdminProfileId(client) {
  const fromEnv = process.env.OPS_MOCK_DATA_ADMIN_PROFILE_ID?.trim();
  if (fromEnv) return fromEnv;

  const { data, error } = await client
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new Error(
      "No admin profile found. Set OPS_MOCK_DATA_ADMIN_PROFILE_ID or provision an admin profile.",
    );
  }
  return data.id;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{
 *   entityType: string;
 *   entityId: string;
 *   adminProfileId: string;
 *   action: string;
 *   outcome: string;
 *   reason?: string;
 *   blockedReason?: string | null;
 *   metadata?: Record<string, unknown>;
 * }} input
 */
export async function recordOpsAdminDeleteAudit(client, input) {
  const idempotencyKey = `ops-mock-data:${input.action}:${input.entityType}:${input.entityId}:${input.outcome}`;
  const row = {
    entity_type: input.entityType,
    entity_id: input.entityId,
    admin_profile_id: input.adminProfileId,
    action: input.action,
    outcome: input.outcome,
    reason: input.reason ?? OPS_ACTOR_REASON,
    blocked_reason: input.blockedReason ?? null,
    metadata: input.metadata ?? { source: "ops_mock_data_purge" },
    idempotency_key: idempotencyKey,
  };

  const { error } = await client.from("admin_delete_audit").insert(row);
  if (error) {
    if (error.code === "23505") return;
    throw error;
  }
}
