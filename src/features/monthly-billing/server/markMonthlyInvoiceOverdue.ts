import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { isZohoMonthlyInvoiceOperationsEnabled } from "@/lib/app/zohoMonthlyInvoiceOperationsFlag";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import { resolveMonthlyInvoiceDueDate } from "./enqueueMonthlyInvoiceNotification";
import {
  loadBatchForOperations,
  markBatchOverdueForOperations,
} from "./monthlyInvoiceOperationsRepository";
import {
  isDueDatePast,
  isOverdueEligibleBatchStatus,
  isTerminalInvoiceOperationsStatus,
} from "./monthlyInvoiceOperationsTypes";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";

export type MarkMonthlyInvoiceOverdueInput = {
  batchId: string;
  adminProfileId: string | null;
  idempotencyKey: string;
  reason?: string;
  force?: boolean;
  client?: SupabaseClient<Database>;
};

export type MarkMonthlyInvoiceOverdueSummary = {
  batchId: string;
  previousStatus: string;
  currentStatus: string;
  dueDate: string | null;
};

export type MarkMonthlyInvoiceOverdueResult =
  | { ok: true; overdue: MarkMonthlyInvoiceOverdueSummary; idempotent: boolean }
  | { ok: false; code: string; message: string };

export async function markMonthlyInvoiceOverdue(
  input: MarkMonthlyInvoiceOverdueInput,
): Promise<MarkMonthlyInvoiceOverdueResult> {
  if (!isZohoMonthlyInvoiceOperationsEnabled()) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      message: "Monthly invoice operations are disabled (ZOHO_MONTHLY_INVOICE_OPERATIONS_ENABLED).",
    };
  }

  const client = input.client ?? requireServiceRoleClient();
  const loaded = await loadBatchForOperations(input.batchId, client);
  if (!loaded) {
    return { ok: false, code: "BATCH_NOT_FOUND", message: "Monthly invoice batch not found." };
  }

  const { batch } = loaded;

  if (isTerminalInvoiceOperationsStatus(batch.status)) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: `Cannot mark overdue for batch in status ${batch.status}.`,
    };
  }

  if (batch.status === "overdue") {
    const billingAccount = await getCustomerBillingAccount(batch.customerId, client);
    const dueDate = billingAccount ? resolveMonthlyInvoiceDueDate(batch, billingAccount) : null;
    return {
      ok: true,
      idempotent: true,
      overdue: {
        batchId: batch.id,
        previousStatus: batch.status,
        currentStatus: batch.status,
        dueDate,
      },
    };
  }

  if (!isOverdueEligibleBatchStatus(batch.status)) {
    return {
      ok: false,
      code: "INVALID_STATUS",
      message: `Batch status ${batch.status} cannot be marked overdue.`,
    };
  }

  const billingAccount = await getCustomerBillingAccount(batch.customerId, client);
  const dueDate = billingAccount ? resolveMonthlyInvoiceDueDate(batch, billingAccount) : null;

  if (!input.force) {
    if (!dueDate) {
      return {
        ok: false,
        code: "DUE_DATE_UNKNOWN",
        message: "Due date could not be resolved; use force with caution or send invoice first.",
      };
    }
    if (!isDueDatePast(dueDate)) {
      return {
        ok: false,
        code: "NOT_PAST_DUE",
        message: `Due date ${dueDate} has not passed yet.`,
      };
    }
  }

  const updated = await markBatchOverdueForOperations(client, batch.id);

  await recordCustomerBillingAccountAudit(client, {
    accountId: billingAccount?.id ?? null,
    customerId: batch.customerId,
    adminProfileId: input.adminProfileId,
    action: "monthly_invoice_marked_overdue",
    idempotencyKey: input.idempotencyKey,
    reason: input.reason ?? null,
    before: { status: batch.status },
    after: { status: updated.status },
    extra: { batchId: batch.id, dueDate, forced: Boolean(input.force) },
  }).catch(() => undefined);

  return {
    ok: true,
    idempotent: false,
    overdue: {
      batchId: batch.id,
      previousStatus: batch.status,
      currentStatus: updated.status,
      dueDate,
    },
  };
}

export type MarkMonthlyInvoicesOverdueCronSummary = {
  checked: number;
  marked: number;
  skipped: number;
  failed: number;
};

export async function markMonthlyInvoicesOverdueForCron(
  limit: number,
  client: SupabaseClient<Database>,
): Promise<MarkMonthlyInvoicesOverdueCronSummary> {
  if (!isZohoMonthlyInvoiceOperationsEnabled()) {
    return { checked: 0, marked: 0, skipped: 0, failed: 0 };
  }

  const { listBatchesEligibleForOverdueMarking } = await import(
    "./monthlyInvoiceOperationsRepository"
  );
  const batches = await listBatchesEligibleForOverdueMarking(limit, client);

  let marked = 0;
  let skipped = 0;
  let failed = 0;

  for (const batch of batches) {
    const result = await markMonthlyInvoiceOverdue({
      batchId: batch.id,
      adminProfileId: null,
      idempotencyKey: `cron-overdue:${batch.id}:${new Date().toISOString().slice(0, 10)}`,
      reason: "Automatic overdue marking",
      client,
    }).catch(() => ({ ok: false as const, code: "INTERNAL_ERROR", message: "Failed." }));

    if (!result.ok) {
      if (result.code === "NOT_PAST_DUE" || result.code === "DUE_DATE_UNKNOWN") {
        skipped += 1;
      } else if (result.code === "INVALID_STATUS" || result.code === "BATCH_NOT_FOUND") {
        skipped += 1;
      } else {
        failed += 1;
      }
      continue;
    }

    if (result.idempotent) {
      skipped += 1;
    } else {
      marked += 1;
    }
  }

  return { checked: batches.length, marked, skipped, failed };
}
