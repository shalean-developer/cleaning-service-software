import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getZohoInvoiceById } from "@/lib/zoho/invoices";
import {
  applyZohoCreditNoteToInvoice,
  createZohoCreditNoteForInvoice,
  recordZohoRefundForCreditNote,
} from "@/lib/zoho/creditNotes";
import { logZohoRefundCreditEvent } from "@/lib/zoho/zohoRefundCreditLogger";
import type { Database, ZohoRefundCreditSyncSourceType } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { loadRefundCreditSourceContext } from "./loadRefundCreditSource";
import { requireZohoRefundCreditSyncEnabled } from "./zohoRefundCreditSyncLaunchGuard";
import {
  findZohoRefundCreditSyncBySource,
  markZohoRefundCreditFailed,
  markZohoRefundCreditSynced,
  recordZohoRefundCreditSyncAttemptStart,
} from "./zohoRefundCreditSyncRepository";
import { shouldExhaustRefundCreditSyncAttempts } from "./zohoRefundCreditSyncRetryPolicy";

export type SyncZohoRefundCreditResult =
  | { ok: true; syncStatus: "synced" | "skipped"; syncId: string }
  | { ok: false; syncId: string; code: string; retryable: boolean };

function safeSyncError(code: string): string {
  return code.slice(0, 500);
}

export async function syncZohoRefundCreditToZoho(
  sourceType: ZohoRefundCreditSyncSourceType,
  sourceId: string,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<SyncZohoRefundCreditResult> {
  const gate = requireZohoRefundCreditSyncEnabled();
  if (!gate.ok) {
    return { ok: false, syncId: sourceId, code: gate.code, retryable: false };
  }

  const syncRow = await findZohoRefundCreditSyncBySource(sourceType, sourceId, client);
  if (!syncRow) {
    return { ok: false, syncId: sourceId, code: "SYNC_ROW_NOT_FOUND", retryable: false };
  }

  if (syncRow.sync_status === "synced") {
    return { ok: true, syncStatus: "skipped", syncId: syncRow.id };
  }

  if (syncRow.sync_status === "failed") {
    return { ok: false, syncId: syncRow.id, code: "SYNC_EXHAUSTED", retryable: false };
  }

  logZohoRefundCreditEvent("zoho_refund_credit_sync_started", {
    syncId: syncRow.id,
    sourceType,
    sourceId,
    amountCents: syncRow.amount_cents,
  });

  await recordZohoRefundCreditSyncAttemptStart(syncRow.id, client);

  const context = await loadRefundCreditSourceContext(sourceType, sourceId, syncRow, client);
  if (!context) {
    const attemptCount = syncRow.sync_attempts + 1;
    await markZohoRefundCreditFailed(
      syncRow.id,
      "REFUND_SOURCE_NOT_FOUND",
      attemptCount,
      client,
    );
    logZohoRefundCreditEvent("zoho_refund_credit_sync_failed", {
      syncId: syncRow.id,
      failureCode: "REFUND_SOURCE_NOT_FOUND",
      retryable: false,
    });
    return { ok: false, syncId: syncRow.id, code: "REFUND_SOURCE_NOT_FOUND", retryable: false };
  }

  if (syncRow.zoho_credit_note_id) {
    await markZohoRefundCreditSynced(
      syncRow.id,
      {
        zohoCreditNoteId: syncRow.zoho_credit_note_id,
        zohoRefundId: syncRow.zoho_refund_id,
        zohoInvoiceId: context.zohoInvoiceId,
        invoiceNumber: context.invoiceNumber,
      },
      client,
    );
    return { ok: true, syncStatus: "skipped", syncId: syncRow.id };
  }

  let customerId = context.customerId;
  if (!customerId) {
    const invoiceLookup = await getZohoInvoiceById(context.zohoInvoiceId);
    if (!invoiceLookup.ok) {
      const attemptCount = syncRow.sync_attempts + 1;
      await markZohoRefundCreditFailed(
        syncRow.id,
        safeSyncError(invoiceLookup.code),
        attemptCount,
        client,
      );
      scheduleFailureLog(syncRow.id, invoiceLookup.code, attemptCount, invoiceLookup.retryable);
      return {
        ok: false,
        syncId: syncRow.id,
        code: invoiceLookup.code,
        retryable: invoiceLookup.retryable,
      };
    }
    customerId = invoiceLookup.invoice.customer_id?.trim() || null;
  }

  if (!customerId) {
    const attemptCount = syncRow.sync_attempts + 1;
    await markZohoRefundCreditFailed(
      syncRow.id,
      "ZOHO_CUSTOMER_ID_MISSING",
      attemptCount,
      client,
    );
    logZohoRefundCreditEvent("zoho_refund_credit_sync_failed", {
      syncId: syncRow.id,
      failureCode: "ZOHO_CUSTOMER_ID_MISSING",
      retryable: false,
    });
    return { ok: false, syncId: syncRow.id, code: "ZOHO_CUSTOMER_ID_MISSING", retryable: false };
  }

  const reference = `${sourceType}-${sourceId}`;

  const creditNote = await createZohoCreditNoteForInvoice({
    zohoInvoiceId: context.zohoInvoiceId,
    invoiceNumber: context.invoiceNumber,
    customerId,
    amountCents: syncRow.amount_cents,
    currency: syncRow.currency,
    reason: syncRow.reason,
    reference,
    lineItemName: context.lineItemName,
  });

  if (!creditNote.ok) {
    const attemptCount = syncRow.sync_attempts + 1;
    await markZohoRefundCreditFailed(
      syncRow.id,
      safeSyncError(creditNote.code),
      attemptCount,
      client,
    );
    scheduleFailureLog(syncRow.id, creditNote.code, attemptCount, creditNote.retryable);
    return {
      ok: false,
      syncId: syncRow.id,
      code: creditNote.code,
      retryable: creditNote.retryable,
    };
  }

  const applyResult = await applyZohoCreditNoteToInvoice({
    zohoCreditNoteId: creditNote.zohoCreditNoteId,
    zohoInvoiceId: context.zohoInvoiceId,
    invoiceNumber: context.invoiceNumber,
    amountCents: syncRow.amount_cents,
  });

  if (!applyResult.ok) {
    const attemptCount = syncRow.sync_attempts + 1;
    await markZohoRefundCreditFailed(
      syncRow.id,
      safeSyncError(applyResult.code),
      attemptCount,
      client,
    );
    scheduleFailureLog(syncRow.id, applyResult.code, attemptCount, applyResult.retryable);
    return {
      ok: false,
      syncId: syncRow.id,
      code: applyResult.code,
      retryable: applyResult.retryable,
    };
  }

  let zohoRefundId: string | null = null;
  if (context.paystackReference) {
    const refundRecord = await recordZohoRefundForCreditNote({
      zohoCreditNoteId: creditNote.zohoCreditNoteId,
      amountCents: syncRow.amount_cents,
      reference: context.paystackReference,
      reason: syncRow.reason,
    });
    if (refundRecord.ok) {
      zohoRefundId = refundRecord.zohoRefundId;
    }
  }

  await markZohoRefundCreditSynced(
    syncRow.id,
    {
      zohoCreditNoteId: creditNote.zohoCreditNoteId,
      zohoRefundId,
      zohoInvoiceId: context.zohoInvoiceId,
      invoiceNumber: context.invoiceNumber,
    },
    client,
  );

  logZohoRefundCreditEvent("zoho_refund_credit_sync_succeeded", {
    syncId: syncRow.id,
    zohoCreditNoteId: creditNote.zohoCreditNoteId,
    zohoInvoiceId: context.zohoInvoiceId,
    amountCents: syncRow.amount_cents,
  });

  return { ok: true, syncStatus: "synced", syncId: syncRow.id };
}

function scheduleFailureLog(
  syncId: string,
  failureCode: string,
  attemptCount: number,
  retryable: boolean,
): void {
  logZohoRefundCreditEvent("zoho_refund_credit_sync_failed", {
    syncId,
    failureCode,
    retryable,
  });

  if (shouldExhaustRefundCreditSyncAttempts(attemptCount)) {
    logZohoRefundCreditEvent("zoho_refund_credit_sync_retry_exhausted", {
      syncId,
      attemptCount,
    });
  } else if (retryable) {
    logZohoRefundCreditEvent("zoho_refund_credit_sync_retry_scheduled", {
      syncId,
      attemptCount,
    });
  }
}
