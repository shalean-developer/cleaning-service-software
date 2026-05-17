import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { hasSentAssignmentOfferForOffer } from "./hasSentAssignmentOfferForOffer";

describe("hasSentAssignmentOfferForOffer", () => {
  it("returns true when another sent assignment_offer row exists for offerId", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: [
              {
                id: "sent-1",
                payload: {
                  template: "assignment_offer",
                  offerId: "offer-a",
                  bookingId: "booking-1",
                },
              },
            ],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(hasSentAssignmentOfferForOffer(client, "offer-a", "row-2")).resolves.toBe(
      true,
    );
  });

  it("returns false when only the current row would match", async () => {
    const client = {
      from: () => ({
        select: () => ({
          eq: async () => ({
            data: [
              {
                id: "row-2",
                payload: {
                  template: "assignment_offer",
                  offerId: "offer-a",
                  bookingId: "booking-1",
                },
              },
            ],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(hasSentAssignmentOfferForOffer(client, "offer-a", "row-2")).resolves.toBe(
      false,
    );
  });
});
