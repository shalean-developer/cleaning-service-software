import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { hasSentPaymentFailedForBooking } from "./hasSentPaymentFailedForBooking";

describe("hasSentPaymentFailedForBooking", () => {
  it("returns true when another sent payment_failed row exists for booking", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: async () => ({
              data: [
                {
                  id: "sent-1",
                  payload: { template: "payment_failed", bookingId: "booking-a" },
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(hasSentPaymentFailedForBooking(client, "booking-a", "row-2")).resolves.toBe(
      true,
    );
  });

  it("returns false when only the current row would match", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: async () => ({
              data: [
                {
                  id: "row-2",
                  payload: { template: "payment_failed", bookingId: "booking-a" },
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(hasSentPaymentFailedForBooking(client, "booking-a", "row-2")).resolves.toBe(
      false,
    );
  });
});
