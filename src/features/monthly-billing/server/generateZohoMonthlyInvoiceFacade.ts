import "server-only";

import type { CurrentUser } from "@/lib/auth/types";
import { isZohoMonthlyInvoiceGenerationEnabled } from "@/lib/app/zohoMonthlyInvoiceGenerationFlag";
import { createZohoMonthlyInvoice } from "@/lib/zoho/monthlyInvoices";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  buildMonthlyBatchZohoReferenceNumber,
  buildZohoMonthlyInvoicePayload,
} from "./buildZohoMonthlyInvoicePayload";
import {
  buildGenerationIdempotencyStoredResult,
  findMonthlyInvoiceGenerationIdempotency,
  storeMonthlyInvoiceGenerationIdempotency,
} from "./monthlyInvoiceGenerationIdempotency";
import {
  assertBatchReadyForGeneration,
  filterGeneratableBatchItems,
  getExistingGeneratedInvoice,
  loadBatchForGeneration,
  markBatchGenerated,
  MonthlyInvoiceBatchGenerationError,
  updateBatchItemsInvoiced,
} from "./monthlyInvoiceGenerationRepository";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";
import { runPostGenerationMonthlyInvoiceAutoSend } from "./runPostGenerationMonthlyInvoiceAutoSend";

export type GenerateZohoMonthlyInvoiceInput = {
  admin: CurrentUser;
  batchId: string;
  idempotencyKey: string;
  reason?: string;
};

export type GeneratedMonthlyInvoiceSummary = {
  batchId: string;
  zohoInvoiceId: string;
  zohoInvoiceNumber: string | null;
  status: string;
  totalCents: number;
  itemCount: number;
};

export type GenerateZohoMonthlyInvoiceResult =
  | { ok: true; invoice: GeneratedMonthlyInvoiceSummary; idempotent: boolean }
  | { ok: false; code: string; message: string; status: number };

function fail(code: string, message: string, status: number): GenerateZohoMonthlyInvoiceResult {
  return { ok: false, code, message, status };
}

function toSummary(input: {
  batchId: string;
  zohoInvoiceId: string;
  zohoInvoiceNumber: string | null;
  status: string;
  totalCents: number;
  itemCount: number;
}): GeneratedMonthlyInvoiceSummary {
  return {
    batchId: input.batchId,
    zohoInvoiceId: input.zohoInvoiceId,
    zohoInvoiceNumber: input.zohoInvoiceNumber,
    status: input.status,
    totalCents: input.totalCents,
    itemCount: input.itemCount,
  };
}

export async function generateZohoMonthlyInvoice(
  input: GenerateZohoMonthlyInvoiceInput,
): Promise<GenerateZohoMonthlyInvoiceResult> {
  if (input.admin.role !== "admin") {
    return fail("FORBIDDEN", "Admins only.", 403);
  }

  if (!isZohoMonthlyInvoiceGenerationEnabled()) {
    return fail(
      "FEATURE_DISABLED",
      "Zoho invoice generation is disabled (ZOHO_MONTHLY_INVOICE_GENERATION_ENABLED).",
      403,
    );
  }

  const client = requireServiceRoleClient();

  const prior = await findMonthlyInvoiceGenerationIdempotency(client, input.idempotencyKey);
  if (prior) {
    return {
      ok: true,
      invoice: toSummary(prior),
      idempotent: true,
    };
  }

  const existing = await getExistingGeneratedInvoice(input.batchId, client);
  if (existing) {
    return { ok: true, invoice: toSummary(existing), idempotent: true };
  }

  let loaded;
  try {
    loaded = await loadBatchForGeneration(input.batchId, client);
    if (!loaded) {
      return fail("BATCH_NOT_FOUND", "Monthly invoice batch not found.", 404);
    }
    assertBatchReadyForGeneration(loaded);
  } catch (e) {
    if (e instanceof MonthlyInvoiceBatchGenerationError) {
      const status =
        e.code === "BATCH_NOT_FOUND"
          ? 404
          : e.code === "MISSING_ZOHO_CUSTOMER" || e.code === "MONTHLY_ACCOUNT_DISABLED"
            ? 422
            : 409;
      return fail(e.code, e.message, status);
    }
    throw e;
  }

  const generatableItems = filterGeneratableBatchItems(loaded.items);
  const payload = buildZohoMonthlyInvoicePayload({
    batch: loaded.batch,
    billingAccount: loaded.billingAccount,
    items: generatableItems,
  });

  const zohoResult = await createZohoMonthlyInvoice({
    payload,
    batchItemIds: generatableItems.map((item) => item.id),
  });

  if (!zohoResult.ok) {
    await recordCustomerBillingAccountAudit(client, {
      accountId: loaded.billingAccount.id,
      customerId: loaded.batch.customerId,
      adminProfileId: input.admin.profileId,
      action: "monthly_invoice_generation_failed",
      idempotencyKey: input.idempotencyKey,
      reason: input.reason ?? null,
      extra: {
        batchId: loaded.batch.id,
        zohoErrorCode: zohoResult.code,
        message: zohoResult.message ?? "Zoho invoice creation failed.",
      },
    }).catch(() => undefined);

    return fail(
      zohoResult.code,
      zohoResult.message ?? "Zoho invoice creation failed.",
      zohoResult.retryable ? 502 : 422,
    );
  }

  try {
    await markBatchGenerated(client, {
      batchId: loaded.batch.id,
      adminProfileId: input.admin.profileId,
      zohoInvoiceId: zohoResult.invoiceId,
      zohoInvoiceNumber: zohoResult.invoiceNumber,
      zohoReferenceNumber: payload.reference_number,
    });

    await updateBatchItemsInvoiced(
      client,
      zohoResult.lineItems.map((line) => ({
        itemId: line.batchItemId,
        zohoLineItemId: line.zohoLineItemId,
      })),
    );
  } catch (e) {
    await recordCustomerBillingAccountAudit(client, {
      accountId: loaded.billingAccount.id,
      customerId: loaded.batch.customerId,
      adminProfileId: input.admin.profileId,
      action: "monthly_invoice_generation_failed",
      idempotencyKey: `${input.idempotencyKey}:persist`,
      reason: input.reason ?? null,
      extra: {
        batchId: loaded.batch.id,
        zohoInvoiceId: zohoResult.invoiceId,
        message: e instanceof Error ? e.message : "Failed to persist generated invoice.",
      },
    }).catch(() => undefined);

    return fail(
      "PERSISTENCE_ERROR",
      e instanceof Error ? e.message : "Failed to persist generated invoice.",
      500,
    );
  }

  const summary = toSummary({
    batchId: loaded.batch.id,
    zohoInvoiceId: zohoResult.invoiceId,
    zohoInvoiceNumber: zohoResult.invoiceNumber,
    status: "generated",
    totalCents: loaded.batch.totalCents,
    itemCount: generatableItems.length,
  });

  await recordCustomerBillingAccountAudit(client, {
    accountId: loaded.billingAccount.id,
    customerId: loaded.batch.customerId,
    adminProfileId: input.admin.profileId,
    action: "monthly_invoice_generated",
    idempotencyKey: input.idempotencyKey,
    reason: input.reason ?? null,
    extra: {
      batchId: loaded.batch.id,
      zohoInvoiceId: zohoResult.invoiceId,
      zohoInvoiceNumber: zohoResult.invoiceNumber,
      zohoReferenceNumber: payload.reference_number,
      totalCents: loaded.batch.totalCents,
      itemCount: generatableItems.length,
    },
  });

  const stored = buildGenerationIdempotencyStoredResult({
    batchId: summary.batchId,
    customerId: loaded.batch.customerId,
    zohoInvoiceId: summary.zohoInvoiceId,
    zohoInvoiceNumber: summary.zohoInvoiceNumber,
    totalCents: summary.totalCents,
    itemCount: summary.itemCount,
  });
  await storeMonthlyInvoiceGenerationIdempotency(client, {
    idempotencyKey: input.idempotencyKey,
    customerId: loaded.batch.customerId,
    adminProfileId: input.admin.profileId,
    result: stored,
  });

  await runPostGenerationMonthlyInvoiceAutoSend(loaded.batch.id, client).catch(() => undefined);

  return { ok: true, invoice: summary, idempotent: false };
}

export { buildMonthlyBatchZohoReferenceNumber };
