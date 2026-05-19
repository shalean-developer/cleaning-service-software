import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/database/types";
import type { Database } from "@/lib/database/types";

export const CUSTOMER_PROFILE_AUDIT_ACTIONS = ["customer_created", "customer_updated"] as const;

export type CustomerProfileAuditAction = (typeof CUSTOMER_PROFILE_AUDIT_ACTIONS)[number];

export const AUDIT_RECORD_FAILED_WARNING =
  "Customer was created but the operational audit log could not be recorded." as const;

export const AUDIT_UPDATE_RECORD_FAILED_WARNING =
  "Customer was updated but the operational audit log could not be recorded." as const;

/** Idempotency key for admin create — one audit row per customer/admin pair. */
export function customerCreatedAuditIdempotencyKey(
  customerId: string,
  adminProfileId: string,
): string {
  return `customer_created:${customerId}:${adminProfileId}`;
}

/** Stable hash for PATCH body fields used in update audit idempotency. */
export function hashCustomerUpdatePatch(patch: Record<string, unknown>): string {
  const sortedKeys = Object.keys(patch).sort();
  const normalized: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    normalized[key] = patch[key];
  }
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 16);
}

/** Idempotency key for admin update — dedupes identical retries of the same patch. */
export function customerUpdatedAuditIdempotencyKey(
  customerId: string,
  adminProfileId: string,
  patchHash: string,
): string {
  return `customer_updated:${customerId}:${adminProfileId}:${patchHash}`;
}

export type RecordCustomerProfileAuditInput = {
  customerId: string;
  adminProfileId: string;
  action: CustomerProfileAuditAction;
  outcome: "success" | "failed";
  reason?: string | null;
  metadata: Json;
  idempotencyKey?: string | null;
};

export async function recordCustomerProfileAudit(
  client: SupabaseClient<Database>,
  input: RecordCustomerProfileAuditInput,
): Promise<string | null> {
  const idempotencyKey =
    input.outcome === "success" && input.idempotencyKey?.trim()
      ? input.idempotencyKey.trim()
      : null;

  const { data, error } = await client
    .from("customer_operational_audit")
    .insert({
      customer_id: input.customerId,
      admin_profile_id: input.adminProfileId,
      action: input.action,
      outcome: input.outcome,
      reason: input.reason?.trim() ? input.reason.trim() : null,
      metadata: input.metadata,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" && idempotencyKey) {
      const { data: existing } = await client
        .from("customer_operational_audit")
        .select("id")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      return existing?.id ?? null;
    }
    throw new Error(error.message);
  }

  return data?.id ?? null;
}
