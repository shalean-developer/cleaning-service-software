import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { archiveCleaner } from "@/features/cleaners/server/lifecycle/archiveCleaner";
import type {
  ArchiveCleanerParams,
  CleanerLifecycleCommandResult,
} from "@/features/cleaners/server/lifecycle/types";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { recordAdminDeleteAudit } from "./recordAdminDeleteAudit";

function lifecycleOutcomeToAdminOutcome(
  result: CleanerLifecycleCommandResult,
): "success" | "rejected" | "idempotent" | "failed" {
  if (!result.ok) {
    return result.outcome === "failed" ? "failed" : "rejected";
  }
  return result.outcome === "idempotent" ? "idempotent" : "success";
}

export async function archiveCleanerAdminCommand(
  params: ArchiveCleanerParams,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CleanerLifecycleCommandResult> {
  const result = await archiveCleaner(params, client);

  const adminOutcome = lifecycleOutcomeToAdminOutcome(result);
  const blockedReason =
    !result.ok && result.code
      ? `${result.code}: ${result.message}`
      : null;

  try {
    await recordAdminDeleteAudit(client, {
      entityType: "cleaner",
      entityId: params.cleanerId,
      adminProfileId: params.adminProfileId,
      action: "archive",
      outcome: adminOutcome,
      reason: params.reason,
      blockedReason,
      metadata: {
        lifecycleAuditId: result.auditId,
        affectedCounts: "affectedCounts" in result ? result.affectedCounts : undefined,
        code: !result.ok ? result.code : null,
      },
      idempotencyKey: params.idempotencyKey
        ? `admin-delete-audit:cleaner:archive:${params.cleanerId}:${params.adminProfileId}`
        : null,
    });
  } catch {
    // Lifecycle audit is primary; admin_delete_audit failure must not undo archive.
  }

  return result;
}
