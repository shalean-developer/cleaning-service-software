import "server-only";

import { readServiceSlugFromBookingMetadata } from "@/features/recurring/readBookingCadence";
import { isMonthlyAccountBillingMetadata } from "@/features/bookings/server/admin/monthlyAccountBookingMetadata";
import { hasActiveMonthlyServiceAuthorization } from "@/features/bookings/server/admin/monthlyServiceAuthorizationRepository";
import { isZohoMonthlyInvoiceAccrualEnabled } from "@/lib/app/zohoMonthlyInvoiceAccrualFlag";
import type { BookingRow } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { getCustomerBillingAccount } from "./customerBillingAccountRepository";
import { recordCustomerBillingAccountAudit } from "./recordCustomerBillingAccountAudit";
import {
  findOrCreateMonthlyInvoiceBatch,
  getExistingBatchItemForBooking,
  insertMonthlyInvoiceBatchItem,
  MonthlyInvoiceBatchLockedError,
  updateMonthlyInvoiceBatchTotal,
} from "./monthlyInvoiceAccrualRepository";
import type {
  AccrueMonthlyInvoiceItemInput,
  MonthlyInvoiceAccrualResult,
} from "./monthlyInvoiceAccrualTypes";
import { resolveBillingMonthFromInstant, resolveVisitDateFromInstant } from "./resolveBillingMonth";

function skip(
  reason: Extract<MonthlyInvoiceAccrualResult, { outcome: "skipped" }>["reason"],
  message: string,
  batchId?: string,
): MonthlyInvoiceAccrualResult {
  return { ok: true, outcome: "skipped", reason, message, batchId };
}

async function loadBooking(bookingId: string): Promise<BookingRow | null> {
  const client = requireServiceRoleClient();
  const { data, error } = await client.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function accrueMonthlyInvoiceItemForBooking(
  input: AccrueMonthlyInvoiceItemInput,
): Promise<MonthlyInvoiceAccrualResult> {
  if (!isZohoMonthlyInvoiceAccrualEnabled()) {
    return skip("feature_disabled", "Monthly invoice accrual is disabled.");
  }

  const booking = input.booking ?? (await loadBooking(input.bookingId));
  if (!booking) {
    return skip("missing_customer", "Booking not found.");
  }

  if (booking.status !== "completed") {
    return skip("not_completed", `Booking status is "${booking.status}", not completed.`);
  }

  if (!booking.customer_id) {
    return skip("missing_customer", "Booking has no customer.");
  }

  if (!isMonthlyAccountBillingMetadata(booking.metadata)) {
    return skip("not_monthly_account", "Booking is not monthly_account billing.");
  }

  const client = requireServiceRoleClient();

  const authorized = await hasActiveMonthlyServiceAuthorization(client, booking.id);
  if (!authorized) {
    return skip("not_service_authorized", "No active monthly service authorization.");
  }

  const amountCents = booking.price_cents;
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return skip("missing_amount", "Booking has no positive price.");
  }

  const visitInstant = booking.scheduled_start || booking.updated_at;
  const billingMonth = resolveBillingMonthFromInstant(visitInstant);
  const visitDate = resolveVisitDateFromInstant(visitInstant);
  if (!billingMonth || !visitDate) {
    return skip("invalid_billing_month", "Could not resolve billing month from visit date.");
  }

  const existingItem = await getExistingBatchItemForBooking(client, booking.id);
  if (existingItem) {
    return {
      ok: true,
      outcome: "already_accrued",
      batchId: existingItem.batch_id,
      itemId: existingItem.id,
      billingMonth,
      amountCents: existingItem.amount_cents,
    };
  }

  const serviceSlug = readServiceSlugFromBookingMetadata(booking.metadata) ?? "unspecified";

  const batchIdempotencyKey = `batch:${booking.customer_id}:${billingMonth}`;

  try {
    const { batch } = await findOrCreateMonthlyInvoiceBatch(client, {
      customerId: booking.customer_id,
      billingMonth,
      idempotencyKey: batchIdempotencyKey,
    });

    const item = await insertMonthlyInvoiceBatchItem(client, {
      batchId: batch.id,
      bookingId: booking.id,
      visitDate,
      serviceSlug,
      amountCents,
      metadata: {
        source: "monthly_invoice_accrual",
        scheduledStart: booking.scheduled_start,
      },
    });

    await updateMonthlyInvoiceBatchTotal(client, batch.id);

    const account = await getCustomerBillingAccount(booking.customer_id, client);

    await recordCustomerBillingAccountAudit(client, {
      accountId: account?.id ?? null,
      customerId: booking.customer_id,
      adminProfileId: null,
      action: "monthly_invoice_item_accrued",
      idempotencyKey: `accrue:${booking.id}`,
      reason: "Post-completion monthly invoice accrual",
      extra: {
        bookingId: booking.id,
        batchId: batch.id,
        itemId: item.id,
        billingMonth,
        amountCents,
      },
    }).catch(() => undefined);

    return {
      ok: true,
      outcome: "accrued",
      batchId: batch.id,
      itemId: item.id,
      billingMonth,
      amountCents,
    };
  } catch (e) {
    if (e instanceof MonthlyInvoiceBatchLockedError) {
      return skip("batch_locked", e.message, e.batchId);
    }
    if (e instanceof Error && e.message.includes("23505")) {
      const raced = await getExistingBatchItemForBooking(client, booking.id);
      if (raced) {
        return {
          ok: true,
          outcome: "already_accrued",
          batchId: raced.batch_id,
          itemId: raced.id,
          billingMonth,
          amountCents: raced.amount_cents,
        };
      }
    }
    return {
      ok: false,
      code: "PERSISTENCE_ERROR",
      message: e instanceof Error ? e.message : "Accrual failed.",
    };
  }
}
