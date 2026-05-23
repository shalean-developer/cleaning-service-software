import "server-only";

import type { BookingRow } from "@/lib/database/types";
import { accrueMonthlyInvoiceItemForBooking } from "./accrueMonthlyInvoiceItemForBooking";
import type { MonthlyInvoiceAccrualResult } from "./monthlyInvoiceAccrualTypes";
import { recordMonthlyInvoiceAccrualDiagnostic } from "./monthlyInvoiceAccrualDiagnostics";

export type PostCompletionMonthlyInvoiceAccrualResult = {
  attempted: boolean;
  result: MonthlyInvoiceAccrualResult | null;
};

/**
 * Best-effort post-completion accrual for monthly_account authorized bookings.
 * Never throws; does not create Zoho invoices or alter payment/earnings state.
 */
export async function runPostCompletionMonthlyInvoiceAccrual(
  booking: BookingRow,
): Promise<PostCompletionMonthlyInvoiceAccrualResult> {
  try {
    const result = await accrueMonthlyInvoiceItemForBooking({
      bookingId: booking.id,
      booking,
    });

    if (
      result.ok &&
      result.outcome === "skipped" &&
      (result.reason === "batch_locked" ||
        result.reason === "missing_amount" ||
        (result.reason === "feature_disabled" && booking.status === "completed"))
    ) {
      await recordMonthlyInvoiceAccrualDiagnostic({
        bookingId: booking.id,
        customerId: booking.customer_id,
        reason: result.reason,
        message: result.message,
        batchId: result.batchId,
      }).catch(() => undefined);
    }

    return { attempted: true, result };
  } catch (e) {
    await recordMonthlyInvoiceAccrualDiagnostic({
      bookingId: booking.id,
      customerId: booking.customer_id,
      reason: "persistence_error",
      message: e instanceof Error ? e.message : String(e),
    }).catch(() => undefined);
    return { attempted: true, result: null };
  }
}
