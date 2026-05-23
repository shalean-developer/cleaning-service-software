import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingRow, Database } from "@/lib/database/types";
import { runPostPaymentAssignmentDispatch } from "@/features/payments/server/postPaymentAssignmentDispatch";
import type { PaystackChargeSuccess } from "@/features/payments/server/paystackTypes";

function syntheticMonthlyAuthorizationCharge(bookingId: string): PaystackChargeSuccess {
  return {
    reference: `admin:monthly-authorized:${bookingId}`,
    providerEventId: `monthly-service-auth:${bookingId}`,
    transactionId: 0,
    amountCents: 0,
    metadata: { source: "monthly_account_service_authorization" },
  };
}

/**
 * Runs canonical assignment dispatch after monthly service authorization.
 * Does not finalize payment or sync Zoho sales.
 */
export async function runPostServiceAuthorizationAssignmentDispatch(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  booking: BookingRow,
  authorizationId: string,
): Promise<void> {
  const charge = syntheticMonthlyAuthorizationCharge(booking.id);
  try {
    await runPostPaymentAssignmentDispatch(client, backend, booking, {
      bookingId: booking.id,
      paymentId: authorizationId,
      customerId: booking.customer_id,
      charge,
    });
  } catch {
    // Observability recorded inside dispatch; authorization stays confirmed.
  }
}
