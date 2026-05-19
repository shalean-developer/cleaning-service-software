import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerBookingDetailsCard } from "./CustomerBookingDetailsCard";

describe("CustomerBookingDetailsCard", () => {
  it("renders service details and payment summary", () => {
    const html = renderToStaticMarkup(
      <CustomerBookingDetailsCard
        serviceLabel="Regular Cleaning"
        homeSizeSummary="2 bedrooms · 1 bathroom"
        cleaningIntensityLabel="Standard"
        equipmentSupplyLabel="Customer supplies"
        teamSupportLabel={null}
        frequencyLabel="Every week"
        addonsSummary="Laundry"
        cleanerPreferenceLabel="Best available"
        assignedCleanerLabel="Cleaner assigned"
        assignmentCustomerMessage={null}
        contactPhoneDisplay="082 123 4567"
        specialInstructions="Ring the bell"
        priceCents={47700}
        currency="ZAR"
        payments={[
          {
            id: "pay-1",
            status: "paid",
            amountCents: 47700,
            currency: "ZAR",
            provider: "paystack",
            providerRef: "ref_123",
          },
        ]}
      />,
    );

    expect(html).toContain("Booking details");
    expect(html).toContain("Regular Cleaning");
    expect(html).toContain("Every week");
    expect(html).toContain("Payment summary");
    expect(html).toContain("Ring the bell");
  });
});
