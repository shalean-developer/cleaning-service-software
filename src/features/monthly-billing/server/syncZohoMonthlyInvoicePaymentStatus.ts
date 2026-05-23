import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isZohoMonthlyInvoicePaymentSyncEnabled } from "@/lib/app/zohoMonthlyInvoicePaymentSyncFlag";
import { getZohoInvoiceById, getZohoInvoiceByNumber, zohoAmountToCents } from "@/lib/zoho/invoices";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import {
  findBatchByZohoInvoiceId,
  findBatchByZohoInvoiceNumber,
  findPaidShaleanZohoInvoicePayment,
  isSyncableBatchPaymentStatus,
  isTerminalBatchPaymentStatus,
  loadBatchForPaymentSync,
  markBatchOverdue,
  markBatchPaid,
  markBatchSent,
  markBatchPaymentSyncFailed,
  markBatchVoid,
  markItemsPaid,
  recordBatchPaymentSyncCheck,
} from "./monthlyInvoicePaymentSyncRepository";
import {
  mapZohoInvoiceFieldsToBatchPaymentStatus,
  type MonthlyInvoicePaymentSyncSource,
  type MonthlyInvoicePaymentSyncTargetStatus,
} from "./monthlyInvoicePaymentSyncTypes";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";

export type SyncZohoMonthlyInvoicePaymentStatusInput = {
  batchId?: string;
  invoiceNumber?: string;
  invoiceId?: string;
  source: MonthlyInvoicePaymentSyncSource;
  adminProfileId?: string | null;
  idempotencyKey?: string;
  reason?: string;
  client?: SupabaseClient<Database>;
};

export type MonthlyInvoicePaymentSyncSummary = {
  batchId: string;
  previousStatus: string;
  currentStatus: string;
  source: MonthlyInvoicePaymentSyncSource;
  paidAt: string | null;
  itemCount: number;
  changed: boolean;
};

export type SyncZohoMonthlyInvoicePaymentStatusResult =
  | { ok: true; outcome: "synced" | "unchanged" | "terminal"; sync: MonthlyInvoicePaymentSyncSummary }
  | { ok: true; outcome: "skipped"; reason: string; code: string }
  | { ok: false; code: string; message: string };

async function resolveBatch(
  client: SupabaseClient<Database>,
  input: SyncZohoMonthlyInvoicePaymentStatusInput,
) {
  if (input.batchId) {
    return loadBatchForPaymentSync(input.batchId, client);
  }
  if (input.invoiceId) {
    const batch = await findBatchByZohoInvoiceId(input.invoiceId, client);
    if (!batch) return null;
    return loadBatchForPaymentSync(batch.id, client);
  }
  if (input.invoiceNumber) {
    const batch = await findBatchByZohoInvoiceNumber(input.invoiceNumber, client);
    if (!batch) return null;
    return loadBatchForPaymentSync(batch.id, client);
  }
  return null;
}

async function applyMappedStatus(
  client: SupabaseClient<Database>,
  loaded: NonNullable<Awaited<ReturnType<typeof loadBatchForPaymentSync>>>,
  targetStatus: MonthlyInvoicePaymentSyncTargetStatus,
  source: MonthlyInvoicePaymentSyncSource,
  paidAtOverride?: string | null,
): Promise<{ batch: typeof loaded.batch; itemsPaid: number; changed: boolean }> {
  const previousStatus = loaded.batch.status;
  let batch = loaded.batch;
  let itemsPaid = 0;
  let changed = false;

  if (targetStatus === "paid" && previousStatus !== "paid") {
    batch = await markBatchPaid(client, batch.id, paidAtOverride ?? new Date().toISOString());
    itemsPaid = await markItemsPaid(client, batch.id);
    changed = true;
  } else if (targetStatus === "overdue" && previousStatus !== "overdue") {
    batch = await markBatchOverdue(client, batch.id);
    changed = true;
  } else if (targetStatus === "void" && previousStatus !== "void") {
    batch = await markBatchVoid(client, batch.id);
    changed = true;
  } else if (targetStatus === "sent" && (previousStatus === "generated" || previousStatus === "overdue")) {
    batch = await markBatchSent(client, batch.id);
    changed = true;
  }

  batch = await recordBatchPaymentSyncCheck(client, batch, {
    source,
    result: batch.status,
  });

  return { batch, itemsPaid, changed: changed || previousStatus !== batch.status };
}

export async function syncZohoMonthlyInvoicePaymentStatus(
  input: SyncZohoMonthlyInvoicePaymentStatusInput,
): Promise<SyncZohoMonthlyInvoicePaymentStatusResult> {
  if (!isZohoMonthlyInvoicePaymentSyncEnabled()) {
    return {
      ok: true,
      outcome: "skipped",
      code: "FEATURE_DISABLED",
      reason: "Monthly invoice payment sync is disabled.",
    };
  }

  const client = input.client ?? requireServiceRoleClient();
  const loaded = await resolveBatch(client, input);
  if (!loaded) {
    return {
      ok: true,
      outcome: "skipped",
      code: "BATCH_NOT_FOUND",
      reason: "No monthly invoice batch matched the sync input.",
    };
  }

  const previousStatus = loaded.batch.status;
  const account = await getCustomerBillingAccount(loaded.batch.customerId, client);

  if (isTerminalBatchPaymentStatus(previousStatus)) {
    const syncMeta = await recordBatchPaymentSyncCheck(client, loaded.batch, {
      source: input.source,
      result: previousStatus,
    });
    return {
      ok: true,
      outcome: "terminal",
      sync: {
        batchId: loaded.batch.id,
        previousStatus,
        currentStatus: previousStatus,
        source: input.source,
        paidAt: syncMeta.paidAt,
        itemCount: loaded.items.length,
        changed: false,
      },
    };
  }

  if (!isSyncableBatchPaymentStatus(previousStatus)) {
    return {
      ok: true,
      outcome: "skipped",
      code: "BATCH_NOT_SYNCABLE",
      reason: `Batch status "${previousStatus}" is not syncable.`,
    };
  }

  if (!loaded.batch.zohoInvoiceId && !loaded.batch.zohoInvoiceNumber) {
    return {
      ok: true,
      outcome: "skipped",
      code: "MISSING_ZOHO_INVOICE",
      reason: "Batch has no Zoho invoice reference.",
    };
  }

  const shaleanPaid = await findPaidShaleanZohoInvoicePayment(client, {
    zohoInvoiceId: loaded.batch.zohoInvoiceId,
    invoiceNumber: loaded.batch.zohoInvoiceNumber,
  });

  if (shaleanPaid) {
    const applied = await applyMappedStatus(client, loaded, "paid", "shalean_pay_page", shaleanPaid.paid_at);
    await recordCustomerBillingAccountAudit(client, {
      accountId: account?.id ?? null,
      customerId: loaded.batch.customerId,
      adminProfileId: input.adminProfileId ?? null,
      action: "monthly_invoice_paid",
      idempotencyKey: input.idempotencyKey ?? `sync:${loaded.batch.id}:${input.source}:paid`,
      reason: input.reason ?? null,
      extra: {
        batchId: loaded.batch.id,
        source: "shalean_pay_page",
        zohoInvoicePaymentId: shaleanPaid.id,
      },
    }).catch(() => undefined);

    await recordCustomerBillingAccountAudit(client, {
      accountId: account?.id ?? null,
      customerId: loaded.batch.customerId,
      adminProfileId: input.adminProfileId ?? null,
      action: "monthly_invoice_payment_sync_checked",
      idempotencyKey: input.idempotencyKey ?? `sync:${loaded.batch.id}:${input.source}:checked`,
      reason: input.reason ?? null,
      extra: {
        batchId: loaded.batch.id,
        source: input.source,
        result: applied.batch.status,
      },
    }).catch(() => undefined);

    return {
      ok: true,
      outcome: applied.changed ? "synced" : "unchanged",
      sync: {
        batchId: loaded.batch.id,
        previousStatus,
        currentStatus: applied.batch.status,
        source: "shalean_pay_page",
        paidAt: applied.batch.paidAt,
        itemCount: applied.itemsPaid || loaded.items.filter((i) => i.status === "paid").length,
        changed: applied.changed,
      },
    };
  }

  const lookup = loaded.batch.zohoInvoiceId
    ? await getZohoInvoiceById(loaded.batch.zohoInvoiceId)
    : loaded.batch.zohoInvoiceNumber
      ? await getZohoInvoiceByNumber(loaded.batch.zohoInvoiceNumber)
      : { ok: false as const, code: "NOT_FOUND" as const };

  if (!lookup.ok) {
    await markBatchPaymentSyncFailed(client, loaded.batch, {
      source: input.source,
      error: lookup.code === "API_ERROR" ? "Zoho invoice lookup failed." : "Zoho invoice not found.",
    });
    await recordCustomerBillingAccountAudit(client, {
      accountId: account?.id ?? null,
      customerId: loaded.batch.customerId,
      adminProfileId: input.adminProfileId ?? null,
      action: "monthly_invoice_payment_sync_failed",
      idempotencyKey: input.idempotencyKey ?? `sync:${loaded.batch.id}:${input.source}:failed`,
      reason: input.reason ?? null,
      extra: {
        batchId: loaded.batch.id,
        source: input.source,
        code: lookup.code,
      },
    }).catch(() => undefined);

    return {
      ok: false,
      code: lookup.code === "API_ERROR" ? "ZOHO_UNAVAILABLE" : "ZOHO_INVOICE_NOT_FOUND",
      message:
        lookup.code === "API_ERROR"
          ? "Zoho invoice lookup failed."
          : "Zoho invoice not found for batch.",
    };
  }

  const balanceCents =
    lookup.invoice.balance != null
      ? zohoAmountToCents(Math.max(0, lookup.invoice.balance))
      : lookup.invoice.total != null
        ? zohoAmountToCents(Math.max(0, lookup.invoice.total))
        : 0;
  const mapped = mapZohoInvoiceFieldsToBatchPaymentStatus({
    zohoStatus: lookup.invoice.status,
    balanceCents,
  });

  if (!mapped.ok) {
    await markBatchPaymentSyncFailed(client, loaded.batch, {
      source: input.source,
      error: mapped.reason,
    });
    await recordCustomerBillingAccountAudit(client, {
      accountId: account?.id ?? null,
      customerId: loaded.batch.customerId,
      adminProfileId: input.adminProfileId ?? null,
      action: "monthly_invoice_payment_sync_failed",
      idempotencyKey: input.idempotencyKey ?? `sync:${loaded.batch.id}:${input.source}:failed`,
      reason: input.reason ?? null,
      extra: { batchId: loaded.batch.id, source: input.source, message: mapped.reason },
    }).catch(() => undefined);

    return {
      ok: false,
      code: "UNKNOWN_ZOHO_STATUS",
      message: mapped.reason,
    };
  }

  const applied = await applyMappedStatus(client, loaded, mapped.status, "zoho_books");

  const auditAction =
    mapped.status === "paid"
      ? "monthly_invoice_paid"
      : mapped.status === "overdue"
        ? "monthly_invoice_overdue"
        : mapped.status === "void"
          ? "monthly_invoice_void"
          : "monthly_invoice_payment_sync_checked";

  await recordCustomerBillingAccountAudit(client, {
    accountId: account?.id ?? null,
    customerId: loaded.batch.customerId,
    adminProfileId: input.adminProfileId ?? null,
    action: auditAction,
    idempotencyKey: input.idempotencyKey ?? `sync:${loaded.batch.id}:${input.source}:${mapped.status}`,
    reason: input.reason ?? null,
    extra: {
      batchId: loaded.batch.id,
      source: "zoho_books",
      zohoStatus: lookup.invoice.status,
      previousStatus,
      currentStatus: applied.batch.status,
    },
  }).catch(() => undefined);

  if (auditAction !== "monthly_invoice_payment_sync_checked") {
    await recordCustomerBillingAccountAudit(client, {
      accountId: account?.id ?? null,
      customerId: loaded.batch.customerId,
      adminProfileId: input.adminProfileId ?? null,
      action: "monthly_invoice_payment_sync_checked",
      idempotencyKey: `${input.idempotencyKey ?? `sync:${loaded.batch.id}:${input.source}`}:checked`,
      reason: input.reason ?? null,
      extra: {
        batchId: loaded.batch.id,
        source: input.source,
        result: applied.batch.status,
      },
    }).catch(() => undefined);
  }

  return {
    ok: true,
    outcome: applied.changed ? "synced" : "unchanged",
    sync: {
      batchId: loaded.batch.id,
      previousStatus,
      currentStatus: applied.batch.status,
      source: "zoho_books",
      paidAt: applied.batch.paidAt,
      itemCount:
        applied.itemsPaid ||
        loaded.items.filter((item) => item.status === "paid" || item.status === "invoiced").length,
      changed: applied.changed,
    },
  };
}

export async function syncMonthlyInvoicePaymentsForCron(
  limit = 50,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<{
  checked: number;
  paid: number;
  overdue: number;
  void: number;
  failed: number;
  unchanged: number;
}> {
  const { loadGeneratedOrSentBatchesForSync } = await import("./monthlyInvoicePaymentSyncRepository");
  const batches = await loadGeneratedOrSentBatchesForSync(limit, client);

  let paid = 0;
  let overdue = 0;
  let voidCount = 0;
  let failed = 0;
  let unchanged = 0;

  for (const batch of batches) {
    const result = await syncZohoMonthlyInvoicePaymentStatus({
      batchId: batch.id,
      source: "cron",
      client,
    });

    if (!result.ok) {
      failed += 1;
      continue;
    }
    if (result.outcome === "skipped" || result.outcome === "terminal") {
      unchanged += 1;
      continue;
    }
    if (result.sync.currentStatus === "paid") paid += 1;
    else if (result.sync.currentStatus === "overdue") overdue += 1;
    else if (result.sync.currentStatus === "void") voidCount += 1;
    else if (!result.sync.changed) unchanged += 1;
  }

  return {
    checked: batches.length,
    paid,
    overdue,
    void: voidCount,
    failed,
    unchanged,
  };
}
