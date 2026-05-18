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

  it("returns nulls when metadata has no service input", () => {
    const details = parseCustomerBookingServiceDetails({ suburb: "Sea Point" }, null);
    expect(details.homeSizeSummary).toBeNull();
    expect(details.frequencyLabel).toBeNull();
    expect(details.addonsSummary).toBeNull();
  });
});
