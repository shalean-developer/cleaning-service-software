import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRow, Database } from "@/lib/database/types";
import { isZohoSalesSyncEnabled } from "./zohoSalesSyncLaunchGuard";
import { enqueueZohoSalesSync } from "./zohoSalesSyncRepository";
import { syncShaleanSaleToZoho } from "./syncShaleanSaleToZoho";
import type { PaystackChargeSuccess } from "@/features/payments/server/paystackTypes";

/**
 * Best-effort post-payment hook: enqueue booking sale sync and attempt once.
 * Booking payment success must never depend on Zoho.
 */
export async function runPostPaymentZohoSalesSync(
  client: SupabaseClient<Database>,
  booking: BookingRow,
  input: {
    paymentId: string;
    charge: PaystackChargeSuccess;
  },
): Promise<void> {
  if (!isZohoSalesSyncEnabled()) {
    return;
  }

  try {
    const syncRow = await enqueueZohoSalesSync(
      {
        sourceType: "booking",
        sourceId: booking.id,
        bookingId: booking.id,
        amountCents: input.charge.amountCents,
        currency: booking.currency,
        metadata: {
          paymentId: input.paymentId,
          paystackReference: input.charge.reference,
        },
      },
      client,
    );

    await syncShaleanSaleToZoho("booking", syncRow.source_id, client);
  } catch {
    // Failures remain in zoho_sales_sync for cron retry; payment stays finalized.
  }
}
