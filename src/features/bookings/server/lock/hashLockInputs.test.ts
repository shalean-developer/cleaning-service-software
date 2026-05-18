import { describe, expect, it } from "vitest";
import { hashLockInputs } from "./hashLockInputs";
import type { BookingLockInput } from "./types";

function baseInput(
  bookingMetadata: Record<string, unknown>,
): BookingLockInput {
  return {
    checkoutIdempotencyKey: "checkout-1",
    clientQuoteTotalCents: 50_000,
    pricingInput: {
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
    },
    scheduledStart: "2030-01-01T08:00:00.000Z",
    scheduledEnd: "2030-01-01T11:00:00.000Z",
    areaSlug: "cape-town",
    cleanerPreference: { mode: "best_available", selectedCleanerId: null },
    bookingMetadata,
  };
}

describe("hashLockInputs", () => {
  it("changes when extraRooms in pricingInput changes", () => {
    const base = hashLockInputs({
      ...baseInput({}),
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        extraRooms: 0,
      },
    });
    const withExtra = hashLockInputs({
      ...baseInput({}),
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        extraRooms: 2,
      },
    });
    expect(base).not.toBe(withExtra);
  });

  it("changes when cleaningIntensity in pricingInput changes", () => {
    const standard = hashLockInputs({
      ...baseInput({}),
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        cleaningIntensity: "standard",
      },
    });
    const heavy = hashLockInputs({
      ...baseInput({}),
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        cleaningIntensity: "heavy",
      },
    });
    expect(standard).not.toBe(heavy);
  });

  it("changes when equipmentSupply in pricingInput changes", () => {
    const customer = hashLockInputs({
      ...baseInput({}),
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        equipmentSupply: "customer",
      },
    });
    const shalean = hashLockInputs({
      ...baseInput({}),
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        equipmentSupply: "shalean",
      },
    });
    expect(customer).not.toBe(shalean);
  });

  it("changes when requestedTeamSize in pricingInput changes", () => {
    const one = hashLockInputs({
      ...baseInput({}),
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        requestedTeamSize: 1,
      },
    });
    const two = hashLockInputs({
      ...baseInput({}),
      pricingInput: {
        serviceSlug: "regular-cleaning",
        bedrooms: 2,
        bathrooms: 1,
        requestedTeamSize: 2,
      },
    });
    expect(one).not.toBe(two);
  });

  it("does not change when booking metadata contactPhone changes", () => {
    const withoutPhone = hashLockInputs(baseInput({}));
    const withPhone = hashLockInputs(
      baseInput({ contactPhone: "+27821234567" }),
    );
    expect(withoutPhone).toBe(withPhone);
  });
});
