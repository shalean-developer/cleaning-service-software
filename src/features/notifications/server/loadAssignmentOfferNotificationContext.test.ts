import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import { testBookingDisplayFields } from "@/test/fixtures";
import {
  formatOfferLocationForEmail,
  isGenericOfferLocationPart,
  loadAssignmentOfferNotificationContext,
  OFFER_EMAIL_AREA_FALLBACK,
  resolveOfferEarningsLabelForEmail,
} from "./loadAssignmentOfferNotificationContext";

describe("loadAssignmentOfferNotificationContext", () => {
  it("uses suburb/city only for location label", () => {
    const label = formatOfferLocationForEmail(
      testBookingDisplayFields({
        serviceSlug: "regular-cleaning",
        suburb: "Sea Point",
        city: "Cape Town",
        addressLine: "12 Secret Street",
        locationSummary: "12 Secret Street, Sea Point, Cape Town",
        specialInstructions: "Ring the bell",
      }),
    );
    expect(label).toBe("Sea Point, Cape Town");
    expect(label).not.toContain("Secret Street");
  });

  it("uses safe fallback for generic Street, Street test placeholders", () => {
    const label = formatOfferLocationForEmail(
      testBookingDisplayFields({
        suburb: "Street",
        city: "Street",
        addressLine: "12 Secret Street",
        locationSummary: "12 Secret Street, Street, Street",
      }),
    );
    expect(label).toBe(OFFER_EMAIL_AREA_FALLBACK);
    expect(label).not.toContain("Street, Street");
  });

  it("uses safe fallback when suburb and city are missing", () => {
    const label = formatOfferLocationForEmail(
      testBookingDisplayFields({
        serviceSlug: null,
        serviceLabel: "Cleaning service",
        suburb: null,
        city: null,
        addressLine: "12 Secret Street",
        locationSummary: "12 Secret Street",
      }),
    );
    expect(label).toBe(OFFER_EMAIL_AREA_FALLBACK);
    expect(label).not.toContain("Secret Street");
  });

  it("flags generic location placeholders", () => {
    expect(isGenericOfferLocationPart("Street")).toBe(true);
    expect(isGenericOfferLocationPart("Sea Point")).toBe(false);
  });

  it("loads offer context with earnings from quote preview", async () => {
    const offerId = "offer-1";
    const bookingId = "booking-1";
    const client = {
      from: (table: string) => {
        if (table === "assignment_offers") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: offerId,
                    booking_id: bookingId,
                    cleaner_id: "cleaner-1",
                    status: "offered",
                    expires_at: "2026-06-03T10:00:00.000Z",
                    offered_at: "2026-06-01T10:00:00.000Z",
                    responded_at: null,
                    created_at: "2026-06-01T10:00:00.000Z",
                    updated_at: "2026-06-01T10:00:00.000Z",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "bookings") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: bookingId,
                    status: "pending_assignment",
                    scheduled_start: "2026-06-01T08:00:00.000Z",
                    scheduled_end: "2026-06-01T10:00:00.000Z",
                    price_cents: 53_000,
                    currency: "ZAR",
                    metadata: {
                      suburb: "Sea Point",
                      city: "Cape Town",
                      quote: {
                        input: { serviceSlug: "regular-cleaning", teamSize: 1 },
                        cleanerEarningsPreview: { perCleanerAmountCents: 45_000 },
                      },
                    },
                    cleaner_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient<Database>;

    const result = await loadAssignmentOfferNotificationContext(client, offerId, bookingId);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.context.serviceLabel).toContain("Regular");
    expect(result.context.locationLabel).toBe("Sea Point, Cape Town");
    expect(result.context.earningsLabel).toContain("450");
  });
});

describe("resolveOfferEarningsLabelForEmail", () => {
  it("returns null when preview cannot be resolved", () => {
    expect(
      resolveOfferEarningsLabelForEmail({}, 50_000, "ZAR"),
    ).toBeNull();
  });
});
