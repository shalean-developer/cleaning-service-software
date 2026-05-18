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
        bedrooms={2}
        bathrooms={1}
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

    expect(html).toContain("Review your booking");
    expect(html).toContain("Home &amp; plan");
    expect(html).toContain("Price breakdown");
    expect(html).toContain("Recurring");
    expect(html).toContain("every week");
    expect(html).toContain("Laundry");
    expect(html).toContain("Edit");
    expect(html).toContain("hidden");
    expect(html).toContain("md:block");
    expect(html).toContain("ready to continue to secure payment");
  });
});
