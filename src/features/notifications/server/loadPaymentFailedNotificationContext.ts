import "server-only";

import { assessPaymentRetryEligibility } from "@/features/bookings/server/paymentRetryEligibility";
import { resolvePaymentFailureReason } from "@/features/bookings/server/paymentFailureDisplay";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, Database, PaymentRow } from "@/lib/database/types";

export type PaymentFailedNotificationContext = {
  failureReason: string | null;
  canRetry: boolean;
};

export async function loadPaymentFailedNotificationContext(
  client: SupabaseClient<Database>,
  booking: Pick<BookingRow, "id" | "status" | "scheduled_start" | "price_cents" | "metadata">,
): Promise<PaymentFailedNotificationContext> {
  const { data: audits, error: auditError } = await client
    .from("booking_state_audit")
    .select("command, metadata, created_at")
    .eq("booking_id", booking.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (auditError) {
    throw new Error(auditError.message);
  }

  const failureReason = resolvePaymentFailureReason(audits ?? []);

  const { data: payments, error: paymentsError } = await client
    .from("payments")
    .select("*")
    .eq("booking_id", booking.id);

  if (paymentsError) {
    throw new Error(paymentsError.message);
  }

  const canRetry = assessPaymentRetryEligibility(
    booking as BookingRow,
    (payments ?? []) as PaymentRow[],
  );

  return { failureReason, canRetry };
}
