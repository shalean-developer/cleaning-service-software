import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createZohoCustomerPaymentForInvoice } from "@/lib/zoho/customerPayments";
import { logZohoInvoicePaymentEvent } from "@/lib/zoho/zohoInvoicePaymentLogger";
import type { Database, ZohoInvoicePaymentRow } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { mapPaystackVerifyData } from "@/features/payments/server/mapPaystackCharge";
import { paystackVerifyTransaction, PaystackApiError } from "@/features/payments/server/paystackClient";
import {
  computeNextReconcileAttemptAt,
  DEFAULT_ZOHO_RECONCILE_BATCH_LIMIT,
  shouldExhaustReconcileAttempts,
} from "./zohoInvoiceReconcileRetryPolicy";
import {
  findZohoInvoicePaymentById,
  incrementZohoInvoicePaymentReconcileAttempt,
  listZohoInvoicePaymentsPendingReconciliation,
  markZohoInvoicePaymentPaid,
  markZohoInvoicePaymentReconcileExhausted,
  markZohoInvoicePaymentReconcileFailed,
  markZohoInvoicePaymentRetrying,
} from "./zohoInvoicePaymentRepository";

export type ZohoInvoiceReconcileRetrySummary = {
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

function emptySummary(): ZohoInvoiceReconcileRetrySummary {
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
  row: ZohoInvoicePaymentRow,
  client: SupabaseClient<Database>,
): Promise<"paid" | "pending" | "failed"> {
  if (row.status === "paid" && row.zoho_payment_id) {
    return "paid";
  }

  if (row.zoho_payment_id) {
    await markZohoInvoicePaymentPaid(
      {
        id: row.id,
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
    await markZohoInvoicePaymentReconcileFailed(
      {
        id: row.id,
        reason: "missing_paystack_reference",
      },
      client,
    );
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
    notes: `Shalean Paystack payment ${reference}`,
  });

  if (!zohoResult.ok) {
    const nextAttempts = (row.reconcile_attempts ?? 0) + 1;
    if (shouldExhaustReconcileAttempts(nextAttempts)) {
      await markZohoInvoicePaymentReconcileExhausted(row.id, zohoResult.code, client);
      return "failed";
    }

    await incrementZohoInvoicePaymentReconcileAttempt(
      {
        id: row.id,
        safeError: zohoResult.code,
        nextAttemptAt: computeNextReconcileAttemptAt(nextAttempts),
      },
      client,
    );
    return "pending";
  }

  await markZohoInvoicePaymentPaid(
    {
      id: row.id,
      zohoPaymentId: zohoResult.zohoPaymentId,
      zohoStatus: zohoResult.zohoStatus,
      paystackStatus: "success",
      reconciliationMetadata: {
        reconciled_via: "cron_retry",
      },
    },
    client,
  );

  return "paid";
}

async function retrySingleRow(
  row: ZohoInvoicePaymentRow,
  client: SupabaseClient<Database>,
): Promise<"paid" | "pending" | "failed" | "skipped"> {
  const fresh = await findZohoInvoicePaymentById(row.id, client);
  if (!fresh) return "skipped";

  if (fresh.status === "paid" && fresh.zoho_payment_id) {
    logZohoInvoicePaymentEvent("zoho_invoice_reconcile_retry_succeeded", {
      invoiceNumber: fresh.invoice_number,
      zohoInvoicePaymentId: fresh.id,
      idempotent: true,
    });
    return "skipped";
  }

  const reference = fresh.paystack_reference?.trim();
  if (!reference) {
    await markZohoInvoicePaymentReconcileFailed(
      { id: fresh.id, reason: "missing_paystack_reference" },
      client,
    );
    return "failed";
  }

  await markZohoInvoicePaymentRetrying(fresh.id, client);

  logZohoInvoicePaymentEvent("zoho_invoice_reconcile_retry_started", {
    invoiceNumber: fresh.invoice_number,
    zohoInvoicePaymentId: fresh.id,
    paystackReference: reference,
    reconcileAttempts: fresh.reconcile_attempts ?? 0,
  });

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
      await markZohoInvoicePaymentReconcileExhausted(fresh.id, safeError, client);
      logZohoInvoicePaymentEvent("zoho_invoice_reconcile_retry_exhausted", {
        invoiceNumber: fresh.invoice_number,
        zohoInvoicePaymentId: fresh.id,
        failureCode: safeError,
      });
      return "failed";
    }

    const nextAttemptAt = computeNextReconcileAttemptAt(nextAttempts);
    await incrementZohoInvoicePaymentReconcileAttempt(
      {
        id: fresh.id,
        safeError,
        nextAttemptAt,
      },
      client,
    );

    logZohoInvoicePaymentEvent("zoho_invoice_reconcile_retry_scheduled", {
      invoiceNumber: fresh.invoice_number,
      zohoInvoicePaymentId: fresh.id,
      failureCode: safeError,
      reconcileAttempts: nextAttempts,
      nextReconcileAttemptAt: nextAttemptAt,
    });

    return "pending";
  }

  if (!verifiedCharge) {
    await markZohoInvoicePaymentReconcileFailed(
      { id: fresh.id, reason: "paystack_status_not_success" },
      client,
    );
    logZohoInvoicePaymentEvent("zoho_invoice_reconcile_retry_failed", {
      invoiceNumber: fresh.invoice_number,
      zohoInvoicePaymentId: fresh.id,
      failureCode: "paystack_status_not_success",
    });
    return "failed";
  }

  if (verifiedCharge.amountCents !== fresh.amount_cents) {
    await markZohoInvoicePaymentReconcileFailed(
      {
        id: fresh.id,
        reason: "amount_mismatch",
      },
      client,
    );
    logZohoInvoicePaymentEvent("zoho_invoice_amount_mismatch", {
      invoiceNumber: fresh.invoice_number,
      zohoInvoicePaymentId: fresh.id,
      expectedAmountCents: fresh.amount_cents,
      actualAmountCents: verifiedCharge.amountCents,
    });
    return "failed";
  }

  const rowCurrency = normalizeCurrency(fresh.currency);
  if (verifiedCurrency !== rowCurrency) {
    await markZohoInvoicePaymentReconcileFailed(
      { id: fresh.id, reason: "currency_mismatch" },
      client,
    );
    logZohoInvoicePaymentEvent("zoho_invoice_currency_mismatch", {
      invoiceNumber: fresh.invoice_number,
      zohoInvoicePaymentId: fresh.id,
      expectedCurrency: rowCurrency,
      actualCurrency: verifiedCurrency,
    });
    return "failed";
  }

  const outcome = await reconcileVerifiedRow(fresh, client);

  if (outcome === "paid") {
    logZohoInvoicePaymentEvent("zoho_invoice_reconcile_retry_succeeded", {
      invoiceNumber: fresh.invoice_number,
      zohoInvoicePaymentId: fresh.id,
    });
    const { runPostZohoInvoicePaymentMonthlyBatchSync } = await import(
      "@/features/monthly-billing/server/runPostZohoInvoicePaymentMonthlyBatchSync"
    );
    await runPostZohoInvoicePaymentMonthlyBatchSync({
      invoiceNumber: fresh.invoice_number,
      zohoInvoiceId: fresh.zoho_invoice_id,
    }).catch(() => undefined);
    return "paid";
  }

  if (outcome === "failed") {
    logZohoInvoicePaymentEvent("zoho_invoice_reconcile_retry_failed", {
      invoiceNumber: fresh.invoice_number,
      zohoInvoicePaymentId: fresh.id,
      failureCode: "reconcile_failed",
    });
    return "failed";
  }

  logZohoInvoicePaymentEvent("zoho_invoice_reconcile_retry_scheduled", {
    invoiceNumber: fresh.invoice_number,
    zohoInvoicePaymentId: fresh.id,
    failureCode: "zoho_reconcile_pending",
  });
  return "pending";
}

export async function retryZohoInvoiceReconciliation(
  options: { limit?: number } = {},
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<ZohoInvoiceReconcileRetrySummary> {
  const limit = options.limit ?? DEFAULT_ZOHO_RECONCILE_BATCH_LIMIT;
  const summary = emptySummary();

  logZohoInvoicePaymentEvent("zoho_invoice_reconcile_cron_started", { limit });

  let rows: ZohoInvoicePaymentRow[] = [];
  try {
    rows = await listZohoInvoicePaymentsPendingReconciliation(limit, client);
  } catch {
    summary.errors.push("load_pending_failed");
    logZohoInvoicePaymentEvent("zoho_invoice_reconcile_cron_completed", summary);
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

  logZohoInvoicePaymentEvent("zoho_invoice_reconcile_cron_completed", summary);
  return summary;
}
