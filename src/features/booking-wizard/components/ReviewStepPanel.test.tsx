import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { ReviewStepPanel } from "./ReviewStepPanel";

const baseProps = {
  date: "2030-06-01",
  time: "10:00",
  addressLine1: "12 Main Rd",
  suburb: "Sea Point",
  city: "Cape Town",
  locationNotes: "",
  contactPhone: "",
  profilePhone: null as string | null,
  propertySizeSqm: null as number | null,
  officeSizeTier: null as null,
  officeWorkstations: null as null,
  reviewConfirmed: false,
  onReviewConfirmedChange: () => {},
};

describe("ReviewStepPanel", () => {
  it("renders compact review hierarchy with edit links and add-on bullets", () => {
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
        {...baseProps}
        serviceLabel="Regular Cleaning"
        serviceSlug="regular-cleaning"
        bedrooms={2}
        bathrooms={1}
        extraRooms={2}
        cleaningIntensity="standard"
        equipmentSupply="customer"
        requestedTeamSize={1}
        frequency="weekly"
        addons={["laundry"]}
        cleanerPreferenceMode="best_available"
        selectedCleanerDisplayName={null}
        quote={quote.breakdown}
        onEditStep={() => {}}
      />,
    );

    expect(html).toContain("Review");
    expect(html).not.toContain("Review your booking");
    expect(html).toContain("Booking details");
    expect(html).toContain("Service options");
    expect(html).toContain("Property details");
    expect(html).toContain("Location &amp; contact");
    expect(html).toContain("Cleaner preference");
    expect(html).toContain("Price breakdown");
    expect(html).toContain("2 beds");
    expect(html).toContain("Recurring");
    expect(html).toContain("Repeats weekly");
    expect(html).toContain("secure Paystack checkout");
    expect(html).not.toMatch(/Property details[\s\S]*Frequency/);
    expect(html).toContain("Laundry");
    expect(html).toContain("Extra rooms");
    expect(html).toContain("2 extra rooms");
    expect(html).toContain("Street address");
    expect(html).toContain("Edit");
    expect(html).toContain("ready for secure payment");
    expect(html).toContain("break-words");
    expect(html).toContain("min-h-11");
  });

  it("shows no add-ons message and access notes when provided", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const html = renderToStaticMarkup(
      <ReviewStepPanel
        {...baseProps}
        serviceLabel="Regular Cleaning"
        serviceSlug="regular-cleaning"
        bedrooms={2}
        bathrooms={1}
        extraRooms={0}
        cleaningIntensity="standard"
        equipmentSupply="customer"
        requestedTeamSize={1}
        frequency="once"
        addons={[]}
        locationNotes="Gate code 4455"
        cleanerPreferenceMode="best_available"
        selectedCleanerDisplayName={null}
        quote={quote.breakdown}
      />,
    );

    expect(html).toContain("No add-ons selected");
    expect(html).toContain("Access notes");
    expect(html).toContain("Gate code 4455");
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
        {...baseProps}
        serviceLabel="Regular Cleaning"
        serviceSlug="regular-cleaning"
        bedrooms={2}
        bathrooms={1}
        extraRooms={0}
        cleaningIntensity="standard"
        equipmentSupply="shalean"
        requestedTeamSize={1}
        frequency="once"
        addons={[]}
        cleanerPreferenceMode="best_available"
        selectedCleanerDisplayName={null}
        quote={quote.breakdown}
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
        {...baseProps}
        serviceLabel="Regular Cleaning"
        serviceSlug="regular-cleaning"
        bedrooms={2}
        bathrooms={1}
        extraRooms={0}
        cleaningIntensity="standard"
        equipmentSupply="customer"
        requestedTeamSize={2}
        frequency="once"
        addons={[]}
        cleanerPreferenceMode="best_available"
        selectedCleanerDisplayName={null}
        quote={quote.breakdown}
      />,
    );

    expect(html).toContain("Team support");
    expect(html).toContain("Request team support");
    expect(html).toContain("Team support request");
    expect(html).not.toContain("confirm team availability after payment");
  });
});
