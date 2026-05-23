import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createZohoCustomerPaymentForInvoice } from "@/lib/zoho/customerPayments";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import type { Database, ZohoInvoiceAuthorizationChargeRow } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { mapPaystackVerifyData } from "@/features/payments/server/mapPaystackCharge";
import { paystackVerifyTransaction, PaystackApiError } from "@/features/payments/server/paystackClient";
import {
  computeNextReconcileAttemptAt,
  DEFAULT_ZOHO_RECONCILE_BATCH_LIMIT,
  shouldExhaustReconcileAttempts,
} from "./zohoInvoiceReconcileRetryPolicy";
import {
  findAuthorizationChargeById,
  listAuthorizationChargesPendingReconciliation,
  markAuthorizationChargePaid,
  markAuthorizationChargeReconcileExhausted,
  markAuthorizationChargeReconcileFailed,
  scheduleAuthorizationChargeReconcileRetry,
} from "./zohoInvoiceAuthorizationChargeRepository";

export type ZohoInvoiceAuthorizationChargeReconcileRetrySummary = {
  scanned: number;
  retried: number;
  paid: number;
  pending: number;
  failed: number;
  skipped: number;
  errors: string[];
};

function normalizeCurrency(value: string | undefined | null): string {
  return (value?.trim() || "ZAR").toUpperCase();
}

function emptySummary(): ZohoInvoiceAuthorizationChargeReconcileRetrySummary {
  return {
    scanned: 0,
    retried: 0,
    paid: 0,
    pending: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
}

async function reconcileVerifiedRow(
  row: ZohoInvoiceAuthorizationChargeRow,
  client: SupabaseClient<Database>,
): Promise<"paid" | "pending" | "failed"> {
  if (row.status === "paid" && row.zoho_payment_id) {
    return "paid";
  }

  if (row.zoho_payment_id) {
    await markAuthorizationChargePaid(
      row.id,
      {
        zohoPaymentId: row.zoho_payment_id,
        zohoStatus: row.zoho_status,
        paystackStatus: "success",
      },
      client,
    );
    return "paid";
  }

  const reference = row.paystack_reference?.trim();
  if (!reference) {
    await markAuthorizationChargeReconcileFailed(row.id, { reason: "missing_paystack_reference" }, client);
    return "failed";
  }

  const zohoResult = await createZohoCustomerPaymentForInvoice({
    zohoInvoiceId: row.zoho_invoice_id,
    invoiceNumber: row.invoice_number,
    customerEmail: row.customer_email,
    amountCents: row.amount_cents,
    currency: row.currency,
    paystackReference: reference,
    paymentDate: new Date().toISOString(),
    notes: `Shalean admin saved-card charge ${reference}`,
  });

  if (!zohoResult.ok) {
    const nextAttempts = (row.reconcile_attempts ?? 0) + 1;
    if (shouldExhaustReconcileAttempts(nextAttempts)) {
      await markAuthorizationChargeReconcileExhausted(row.id, zohoResult.code, client);
      return "failed";
    }

    await scheduleAuthorizationChargeReconcileRetry(
      row.id,
      {
        reconcileAttempts: nextAttempts,
        nextReconcileAttemptAt: computeNextReconcileAttemptAt(nextAttempts),
        reason: zohoResult.code,
      },
      client,
    );
    return "pending";
  }

  await markAuthorizationChargePaid(
    row.id,
    {
      zohoPaymentId: zohoResult.zohoPaymentId,
      zohoStatus: zohoResult.zohoStatus,
      paystackStatus: "success",
      metadata: {
        reconciled_via: "cron_retry",
      },
    },
    client,
  );

  return "paid";
}

async function retrySingleRow(
  row: ZohoInvoiceAuthorizationChargeRow,
  client: SupabaseClient<Database>,
): Promise<"paid" | "pending" | "failed" | "skipped"> {
  const fresh = await findAuthorizationChargeById(row.id, client);
  if (!fresh) return "skipped";

  if (fresh.status === "paid" && fresh.zoho_payment_id) {
    return "skipped";
  }

  const reference = fresh.paystack_reference?.trim();
  if (!reference) {
    await markAuthorizationChargeReconcileFailed(
      fresh.id,
      { reason: "missing_paystack_reference" },
      client,
    );
    return "failed";
  }

  let verifiedCharge = null as ReturnType<typeof mapPaystackVerifyData>;
  let verifiedCurrency = normalizeCurrency(fresh.currency);

  try {
    const verifyResponse = await paystackVerifyTransaction(reference);
    verifiedCurrency = normalizeCurrency(verifyResponse.data.currency);
    verifiedCharge = mapPaystackVerifyData(verifyResponse.data);
  } catch (error) {
    const safeError =
      error instanceof PaystackApiError
        ? `paystack_verify_api_${error.statusCode}`
        : "paystack_verify_failed";

    const nextAttempts = (fresh.reconcile_attempts ?? 0) + 1;
    if (shouldExhaustReconcileAttempts(nextAttempts)) {
      await markAuthorizationChargeReconcileExhausted(fresh.id, safeError, client);
      return "failed";
    }

    await scheduleAuthorizationChargeReconcileRetry(
      fresh.id,
      {
        reconcileAttempts: nextAttempts,
        nextReconcileAttemptAt: computeNextReconcileAttemptAt(nextAttempts),
        reason: safeError,
      },
      client,
    );
    return "pending";
  }

  if (!verifiedCharge) {
    await markAuthorizationChargeReconcileFailed(
      fresh.id,
      { reason: "paystack_status_not_success" },
      client,
    );
    return "failed";
  }

  if (verifiedCharge.amountCents !== fresh.amount_cents) {
    await markAuthorizationChargeReconcileFailed(fresh.id, { reason: "amount_mismatch" }, client);
    return "failed";
  }

  const rowCurrency = normalizeCurrency(fresh.currency);
  if (verifiedCurrency !== rowCurrency) {
    await markAuthorizationChargeReconcileFailed(fresh.id, { reason: "currency_mismatch" }, client);
    return "failed";
  }

  const outcome = await reconcileVerifiedRow(fresh, client);
  if (outcome === "paid") return "paid";
  if (outcome === "failed") return "failed";
  return "pending";
}

export async function retryZohoInvoiceAuthorizationChargeReconciliation(
  options: { limit?: number } = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceAuthorizationChargeReconcileRetrySummary> {
  const limit = options.limit ?? DEFAULT_ZOHO_RECONCILE_BATCH_LIMIT;
  const summary = emptySummary();

  let rows: ZohoInvoiceAuthorizationChargeRow[] = [];
  try {
    rows = await listAuthorizationChargesPendingReconciliation(limit, client);
  } catch {
    summary.errors.push("load_pending_failed");
    return summary;
  }

  summary.scanned = rows.length;

  for (const row of rows) {
    summary.retried += 1;
    try {
      const outcome = await retrySingleRow(row, client);
      if (outcome === "paid") summary.paid += 1;
      else if (outcome === "pending") summary.pending += 1;
      else if (outcome === "failed") summary.failed += 1;
      else summary.skipped += 1;
    } catch {
      summary.errors.push(`retry_failed:${row.id}`);
      summary.pending += 1;
    }
  }

  logZohoInvoicePaymentEvent("zoho_invoice_reconcile_cron_completed", {
    authorizationChargeRetry: true,
    ...summary,
  });

  return summary;
}
