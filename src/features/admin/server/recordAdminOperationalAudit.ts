import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import type {
  AdminOperationalOutcome,
  RecordAdminOperationalAuditInput,
} from "./adminOperationalAuditTypes";

const SENSITIVE_METADATA_KEYS = new Set([
  "authorization",
  "secret",
  "token",
  "password",
  "card",
  "signature",
  "raw",
  "payload",
  "webhook",
  "paystack",
]);

const ALLOWED_METADATA_KEYS = new Set([
  "acknowledge_max_attempts",
  "dispatch_offer_count",
  "open_offer_count",
  "engine_outcome",
  "engine_idempotent",
  "result_status",
  "http_status",
  "eligible",
  "cancelled_cleaner_id",
  "target_cleaner_id",
  "outboxId",
  "template",
  "oldStatus",
  "newStatus",
  "deliveryDedupeWouldBlock",
]);

/**
 * Strips unsafe keys and non-primitive values from admin operational audit metadata.
 */
export function sanitizeAdminOperationalMetadata(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_METADATA_KEYS.has(lower)) continue;
    if (lower.includes("secret") || lower.includes("token") || lower.includes("password")) {
      continue;
    }
    if (!ALLOWED_METADATA_KEYS.has(key) && !ALLOWED_METADATA_KEYS.has(lower)) {
      continue;
    }
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      if (typeof value === "string" && value.length > 200) continue;
      out[key] = value;
    }
  }
  return out;
}

export function summarizeAdminOperationalMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const safe = sanitizeAdminOperationalMetadata(metadata);
  const parts: string[] = [];
  for (const [key, value] of Object.entries(safe)) {
    if (value === null || value === undefined) continue;
    parts.push(`${key}=${String(value)}`);
  }
  return parts.length > 0 ? parts.join("; ") : null;
}

function shouldAttachIdempotencyKey(outcome: AdminOperationalOutcome): boolean {
  return outcome === "success" || outcome === "idempotent";
}

/**
 * Persists an admin operational audit row via service role. Never throws — logs on failure.
 */
export async function recordAdminOperationalAudit(
  client: SupabaseClient<Database> | null,
  input: RecordAdminOperationalAuditInput,
): Promise<void> {
  if (!client) return;

  const idempotencyKey =
    input.idempotencyKey && shouldAttachIdempotencyKey(input.outcome)
      ? input.idempotencyKey.trim()
      : null;

  const row = {
    booking_id: input.bookingId,
    admin_profile_id: input.adminProfileId,
    action: input.action,
    outcome: input.outcome,
    reason: input.reason?.trim() ? input.reason.trim() : null,
    result_code: input.resultCode?.trim() ? input.resultCode.trim() : null,
    cleaner_id: input.cleanerId ?? null,
    offer_id: input.offerId ?? null,
    cancelled_offer_id: input.cancelledOfferId ?? null,
    idempotency_key: idempotencyKey,
    booking_status_before: input.bookingStatusBefore ?? null,
    booking_status_after: input.bookingStatusAfter ?? null,
    metadata: sanitizeAdminOperationalMetadata(input.metadata),
  };

  try {
    const { error } = await client.from("admin_operational_audit").insert(row);
    if (error) {
      console.warn(
        JSON.stringify({
          event: "admin_operational_audit_persist_failed",
          at: new Date().toISOString(),
          bookingId: input.bookingId,
          action: input.action,
          outcome: input.outcome,
          code: error.code,
          message: error.message,
        }),
      );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.warn(
      JSON.stringify({
        event: "admin_operational_audit_persist_failed",
        at: new Date().toISOString(),
        bookingId: input.bookingId,
        action: input.action,
        outcome: input.outcome,
        message,
      }),
    );
  }
}
