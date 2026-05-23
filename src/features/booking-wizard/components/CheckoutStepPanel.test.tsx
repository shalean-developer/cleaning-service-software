import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { CheckoutCtaTrustRow, CheckoutStepPanel } from "./CheckoutStepPanel";

describe("CheckoutStepPanel", () => {
  it("renders payment-focused checkout without review duplication", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      frequency: "weekly",
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const html = renderToStaticMarkup(
      <CheckoutStepPanel
        serviceLabel="Regular Cleaning"
        serviceSlug="regular-cleaning"
        date="2030-06-01"
        time="10:00"
        suburb="Sea Point"
        city="Cape Town"
        bedrooms={2}
        bathrooms={1}
        propertySizeSqm={null}
        frequency="weekly"
        quote={quote.breakdown}
        customerEmail="guest@example.com"
      />,
    );

    expect(html).toContain("Secure payment");
    expect(html).toContain("Booking snapshot");
    expect(html).toContain("Processed securely by Paystack");
    expect(html).toContain("Amount due today");
    expect(html).toContain("What happens next");
    expect(html).toContain("Booking confirmation");
    expect(html).toContain("Confirmation email");
    expect(html).toContain("Cleaner assignment");
    expect(html).toContain("Your first payment confirms your first visit only");
    expect(html).not.toContain("Booking details");
    expect(html).not.toContain("Team support");
    expect(html).not.toContain("Recurring clean");
    expect(html).not.toContain("Intensity");
    expect(html).not.toContain("Paystack encrypts");
  });

  it("shows paying-as email helper for once-off bookings", () => {
    const quote = calculateQuote({
      serviceSlug: "regular-cleaning",
      bedrooms: 2,
      bathrooms: 1,
      frequency: "once",
    });
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;

    const html = renderToStaticMarkup(
      <CheckoutStepPanel
        serviceLabel="Regular Cleaning"
        serviceSlug="regular-cleaning"
        date="2030-06-01"
        time="10:00"
        suburb="Sea Point"
        city="Cape Town"
        bedrooms={2}
        bathrooms={1}
        propertySizeSqm={null}
        frequency="once"
        quote={quote.breakdown}
        customerEmail="guest@example.com"
      />,
    );

    expect(html).toContain("Paying as guest@example.com");
    expect(html).not.toContain("Recurring clean");
  });

  it("renders CTA trust row for checkout footer", () => {
    const html = renderToStaticMarkup(<CheckoutCtaTrustRow />);
    expect(html).toContain("Secure payment");
    expect(html).toContain("Instant confirmation");
    expect(html).toContain("Trusted local cleaners");
  });
});
