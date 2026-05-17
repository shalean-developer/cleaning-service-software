import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ASSIGNMENT_OFFER_TEMPLATE,
  PAYMENT_CONFIRMED_TEMPLATE,
  PAYMENT_FAILED_TEMPLATE,
} from "./config";
import { hasSentAssignmentOfferForOffer } from "./hasSentAssignmentOfferForOffer";
import { hasSentPaymentConfirmedForBooking } from "./hasSentPaymentConfirmedForBooking";
import { hasSentPaymentFailedForBooking } from "./hasSentPaymentFailedForBooking";
import type { Database } from "@/lib/database/types";

/**
 * True when worker delivery dedupe would skip a send for this template/booking/offer.
 */
export async function computeDeliveryDedupeWouldBlock(
  client: SupabaseClient<Database>,
  input: {
    template: string;
    bookingId: string;
    offerId: string | null;
    excludeOutboxId: string;
  },
): Promise<boolean> {
  const { template, bookingId, offerId, excludeOutboxId } = input;

  if (template === PAYMENT_CONFIRMED_TEMPLATE) {
    return hasSentPaymentConfirmedForBooking(client, bookingId, excludeOutboxId);
  }
  if (template === PAYMENT_FAILED_TEMPLATE) {
    return hasSentPaymentFailedForBooking(client, bookingId, excludeOutboxId);
  }
  if (template === ASSIGNMENT_OFFER_TEMPLATE && offerId) {
    return hasSentAssignmentOfferForOffer(client, offerId, excludeOutboxId);
  }
  return false;
}
