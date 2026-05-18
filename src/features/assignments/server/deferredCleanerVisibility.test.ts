import { describe, expect, it } from "vitest";
import { findDeferredAssignmentDispatchCandidates } from "./findDeferredAssignmentDispatchCandidates";
import { InMemoryBookingCommandBackend } from "@/features/bookings/server/commands/inMemoryBookingCommandBackend";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";

/**
 * Cleaners only see rows in assignment_offers / assigned bookings.
 * Deferred confirmed bookings have no offers until runAssignmentAfterPayment runs.
 */
describe("deferred cleaner visibility", () => {
  it("deferred paid booking is not a dispatch candidate before dispatch window", async () => {
    const backend = new InMemoryBookingCommandBackend();
    const bookingId = crypto.randomUUID();
    const paymentId = crypto.randomUUID();
    const ts = new Date().toISOString();
    const futureDispatch = new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString();

    backend.bookings.set(bookingId, {
      id: bookingId,
      customer_id: "cust-1",
      cleaner_id: null,
      service_id: null,
      status: "confirmed",
      scheduled_start: new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString(),
      scheduled_end: new Date(Date.now() + 31 * 24 * 60 * 60_000).toISOString(),
      assignment_dispatch_at: futureDispatch,
      price_cents: 1000,
      currency: "ZAR",
      series_id: null,
      metadata: {},
      created_at: ts,
      updated_at: ts,
    });
    backend.payments.set(paymentId, {
      id: paymentId,
      booking_id: bookingId,
      status: "paid",
      provider: "paystack",
      provider_ref: "ref",
      idempotency_key: "key",
      amount_cents: 1000,
      currency: "ZAR",
      payment_link_expires_at: null,
      metadata: {},
      created_at: ts,
      updated_at: ts,
    });

    const client = {
      from(table: string) {
        if (table === "bookings") {
          return {
            select: () => ({
              eq: () => ({
                not: () => ({
                  lte: () => ({
                    order: () => ({
                      limit: async () => ({ data: [], error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected ${table}`);
      },
    } as unknown as SupabaseClient<Database>;

    const candidates = await findDeferredAssignmentDispatchCandidates(client, {
      now: new Date(),
    });
    expect(candidates.find((c) => c.bookingId === bookingId)).toBeUndefined();
    expect(backend.offers.size).toBe(0);
  });
});
