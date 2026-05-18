import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { ReviewStepPanel } from "./ReviewStepPanel";

describe("ReviewStepPanel", () => {
  it("renders premium review hierarchy with frequency highlight and edit links", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      frequency: "weekly",
      addons: ["laundry"],
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const html = renderToStaticMarkup(
      <ReviewStepPanel
        serviceLabel="Regular Cleaning"
        serviceSlug="regular-cleaning"
        date="2030-06-01"
        time="10:00"
        addressLine1="12 Main Rd"
        suburb="Sea Point"
        city="Cape Town"
        contactPhone=""
        profilePhone={null}
        bedrooms={2}
        bathrooms={1}
        extraRooms={2}
        cleaningIntensity="standard"
        equipmentSupply="customer"
        requestedTeamSize={1}
        propertySizeSqm={null}
        frequency="weekly"
        addons={["laundry"]}
        cleanerPreferenceMode="best_available"
        selectedCleanerDisplayName={null}
        quote={quote.breakdown}
        reviewConfirmed={false}
        onReviewConfirmedChange={() => {}}
        onEditStep={() => {}}
      />,
    );

    expect(html).toContain("Review");
    expect(html).not.toContain("Review your booking");
    expect(html).toContain("Schedule");
    expect(html).toContain("Date &amp; time");
    expect(html).toContain("Home &amp; plan");
    expect(html).toContain("Price breakdown");
    expect(html).toContain("Recurring");
    expect(html).toContain("every week");
    expect(html).not.toMatch(/Home &amp; plan[\s\S]*Frequency/);
    expect(html).toContain("Laundry");
    expect(html).toContain("Extra rooms");
    expect(html).toContain("2 extra rooms");
    expect(html).toContain("Edit");
    expect(html).toContain("hidden");
    expect(html).toContain("md:block");
    expect(html).toContain("ready to continue to secure payment");
  });

  it("shows cleaning supplies and equipment fee for Shalean-provided", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      equipmentSupply: "shalean",
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const html = renderToStaticMarkup(
      <ReviewStepPanel
        serviceLabel="Regular Cleaning"
        serviceSlug="regular-cleaning"
        date="2030-06-01"
        time="10:00"
        addressLine1="12 Main Rd"
        suburb="Sea Point"
        city="Cape Town"
        contactPhone=""
        profilePhone={null}
        bedrooms={2}
        bathrooms={1}
        extraRooms={0}
        cleaningIntensity="standard"
        equipmentSupply="shalean"
        requestedTeamSize={1}
        propertySizeSqm={null}
        frequency="once"
        addons={[]}
        cleanerPreferenceMode="best_available"
        selectedCleanerDisplayName={null}
        quote={quote.breakdown}
        reviewConfirmed={false}
        onReviewConfirmedChange={() => {}}
      />,
    );

    expect(html).toContain("Cleaning supplies");
    expect(html).toContain("Shalean-provided");
    expect(html).toContain("Cleaning equipment");
    expect(html).not.toContain("Shalean cleaning supplies");
  });

  it("shows team support request and surcharge line for 2-cleaner request", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      requestedTeamSize: 2,
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const html = renderToStaticMarkup(
      <ReviewStepPanel
        serviceLabel="Regular Cleaning"
        serviceSlug="regular-cleaning"
        date="2030-06-01"
        time="10:00"
        addressLine1="12 Main Rd"
        suburb="Sea Point"
        city="Cape Town"
        contactPhone=""
        profilePhone={null}
        bedrooms={2}
        bathrooms={1}
        extraRooms={0}
        cleaningIntensity="standard"
        equipmentSupply="customer"
        requestedTeamSize={2}
        propertySizeSqm={null}
        frequency="once"
        addons={[]}
        cleanerPreferenceMode="best_available"
        selectedCleanerDisplayName={null}
        quote={quote.breakdown}
        reviewConfirmed={false}
        onReviewConfirmedChange={() => {}}
      />,
    );

    expect(html).toContain("Team support");
    expect(html).toContain("Request 2 cleaners");
    expect(html).not.toContain("confirm team availability after payment");
    expect(html).toContain("2-cleaner request surcharge");
  });
});
