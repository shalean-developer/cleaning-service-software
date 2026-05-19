import { describe, expect, it } from "vitest";
import { parseCustomerBookingServiceDetails } from "./customerBookingServiceDetailsDisplay";

describe("parseCustomerBookingServiceDetails", () => {
  it("reads home size, frequency, and addons from wizard metadata", () => {
    const details = parseCustomerBookingServiceDetails(
      {
        quote: {
          input: {
            serviceSlug: "regular-cleaning",
            bedrooms: 2,
            bathrooms: 1,
            frequency: "weekly",
            addons: ["laundry"],
          },
        },
      },
      "regular-cleaning",
    );

    expect(details.homeSizeSummary).toContain("2 bedroom");
    expect(details.frequencyLabel).toBe("Weekly");
    expect(details.addonsSummary).toContain("Laundry");
  });

  it("includes extra rooms in home size summary", () => {
    const details = parseCustomerBookingServiceDetails(
      {
        quote: {
          input: {
            serviceSlug: "regular-cleaning",
            bedrooms: 2,
            bathrooms: 1,
            extraRooms: 2,
          },
        },
      },
      "regular-cleaning",
    );

    expect(details.homeSizeSummary).toContain("2 extra rooms");
  });

  it("returns nulls when metadata has no service input", () => {
    const details = parseCustomerBookingServiceDetails({ suburb: "Sea Point" }, null);
    expect(details.homeSizeSummary).toBeNull();
    expect(details.frequencyLabel).toBeNull();
    expect(details.addonsSummary).toBeNull();
    expect(details.cleaningIntensityLabel).toBeNull();
  });

  it("shows cleaning intensity label for non-standard regular cleaning", () => {
    const details = parseCustomerBookingServiceDetails(
      {
        quote: {
          input: {
            serviceSlug: "regular-cleaning",
            bedrooms: 2,
            bathrooms: 1,
            cleaningIntensity: "detailed",
          },
        },
      },
      "regular-cleaning",
    );

    expect(details.cleaningIntensityLabel).toBe("Detailed");
  });

  it("shows cleaning supplies labels for regular cleaning", () => {
    const shalean = parseCustomerBookingServiceDetails(
      {
        quote: {
          input: {
            serviceSlug: "regular-cleaning",
            bedrooms: 2,
            bathrooms: 1,
            equipmentSupply: "shalean",
          },
        },
      },
      "regular-cleaning",
    );

    expect(shalean.equipmentSupplyLabel).toBe("Shalean-provided");
    expect(shalean.equipmentSupplyOperationalLabel).toBe("Bring cleaning equipment");

    const customer = parseCustomerBookingServiceDetails(
      {
        quote: {
          input: {
            serviceSlug: "regular-cleaning",
            bedrooms: 2,
            bathrooms: 1,
          },
        },
      },
      "regular-cleaning",
    );

    expect(customer.equipmentSupplyLabel).toBe("Customer-provided");
    expect(customer.equipmentSupplyOperationalLabel).toBe("Customer provides supplies");
  });

  it("defaults missing cleaning intensity to standard (no label)", () => {
    const details = parseCustomerBookingServiceDetails(
      {
        quote: {
          input: {
            serviceSlug: "regular-cleaning",
            bedrooms: 2,
            bathrooms: 1,
          },
        },
      },
      "regular-cleaning",
    );

    expect(details.cleaningIntensityLabel).toBeNull();
  });

  it("shows team support labels and flags 2-cleaner requests", () => {
    const details = parseCustomerBookingServiceDetails(
      {
        quote: {
          input: {
            serviceSlug: "regular-cleaning",
            bedrooms: 2,
            bathrooms: 1,
            requestedTeamSize: 2,
          },
        },
      },
      "regular-cleaning",
    );

    expect(details.teamSupportLabel).toBe("Team support requested");
    expect(details.isTwoCleanerRequest).toBe(true);
    expect(details.teamSupportCleanerNote).toBe(
      "Team support requested. Coordinate arrival with operations if needed.",
    );
  });
});
