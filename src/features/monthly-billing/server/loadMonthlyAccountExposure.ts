import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { computeMonthlyAccountExposure } from "./computeMonthlyAccountExposure";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import { listMonthlyInvoiceBatches } from "./monthlyInvoiceBatchRepository";
import {
  daysBetweenDates,
  readMonthlyInvoiceDeliveryMetadata,
} from "./monthlyInvoiceDeliveryTypes";
import { resolveMonthlyInvoiceDueDate } from "./enqueueMonthlyInvoiceNotification";
import type { MonthlyAccountExposureSnapshot } from "../monthlyAccountGovernanceTypes";
import type { CustomerBillingAccount } from "./monthlyBillingTypes";

const UNPAID_BATCH_STATUSES = new Set(["generated", "sent", "overdue"]);

export type LoadMonthlyAccountExposureResult = MonthlyAccountExposureSnapshot & {
  lastPaymentAt: string | null;
};

async function sumPendingAuthorizedExposure(
  customerId: string,
  client: SupabaseClient<Database>,
): Promise<number> {
  const { data: authorizations, error } = await client
    .from("monthly_service_authorizations")
    .select("booking_id, amount_cents, status")
    .eq("customer_id", customerId)
    .eq("status", "authorized");

  if (error) throw new Error(error.message);
  if (!authorizations?.length) return 0;

  const bookingIds = authorizations.map((row) => row.booking_id);
  const { data: batchItems, error: itemsError } = await client
    .from("monthly_invoice_batch_items")
    .select("booking_id, status")
    .in("booking_id", bookingIds);

  if (itemsError) throw new Error(itemsError.message);

  const invoicedBookingIds = new Set(
    (batchItems ?? [])
      .filter((item) => item.status === "invoiced" || item.status === "paid")
      .map((item) => item.booking_id),
  );

  return authorizations.reduce((sum, row) => {
    if (invoicedBookingIds.has(row.booking_id)) return sum;
    return sum + row.amount_cents;
  }, 0);
}

export async function loadMonthlyAccountExposureForCustomer(
  customerId: string,
  account?: CustomerBillingAccount | null,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<LoadMonthlyAccountExposureResult> {
  const billingAccount = account ?? (await getCustomerBillingAccount(customerId, client));
  const batches = await listMonthlyInvoiceBatches({ customerId, limit: 500 }, client);
  const nowIso = new Date().toISOString();

  let outstandingBalanceCents = 0;
  let disputedInvoiceCount = 0;
  let overdueInvoiceCount = 0;
  let lastPaymentAt: string | null = null;

  for (const batch of batches) {
    if (batch.paidAt) {
      if (!lastPaymentAt || batch.paidAt > lastPaymentAt) {
        lastPaymentAt = batch.paidAt;
      }
    }

    const delivery = readMonthlyInvoiceDeliveryMetadata(batch.metadata);
    const isDisputed = delivery.collectionsState === "disputed";

    if (UNPAID_BATCH_STATUSES.has(batch.status)) {
      outstandingBalanceCents += batch.totalCents;
      const dueDate = billingAccount ? resolveMonthlyInvoiceDueDate(batch, billingAccount) : null;
      if (dueDate && daysBetweenDates(dueDate, nowIso) > 0) {
        overdueInvoiceCount += 1;
      }
    }

    if (isDisputed && batch.status !== "paid") {
      disputedInvoiceCount += 1;
    }
  }

  const pendingExposureCents = await sumPendingAuthorizedExposure(customerId, client);

  const exposure = computeMonthlyAccountExposure({
    outstandingBalanceCents,
    pendingExposureCents,
    creditLimitCents: billingAccount?.creditLimitCents ?? null,
    disputedInvoiceCount,
    overdueInvoiceCount,
    governanceState: billingAccount?.governanceState,
  });

  return { ...exposure, lastPaymentAt };
}
