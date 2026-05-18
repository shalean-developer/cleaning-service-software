import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { CheckoutStepPanel } from "./CheckoutStepPanel";

describe("CheckoutStepPanel", () => {
  it("renders reassurance, recurring copy, and desktop-only amount", () => {
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
        extraRooms={0}
        cleaningIntensity="standard"
        equipmentSupply="customer"
        requestedTeamSize={1}
        propertySizeSqm={null}
        frequency="weekly"
        quote={quote.breakdown}
        customerEmail="guest@example.com"
      />,
    );

    expect(html).toContain("Secure checkout");
    expect(html).toContain("Secured by Paystack");
    expect(html).toContain("What happens after you pay");
    expect(html).toContain("Secure payment");
    expect(html).toContain("Cleaner assignment");
    expect(html).toContain("Email updates");
    expect(html).toContain("Recurring clean");
    expect(html).toContain("Today");
    expect(html).toContain("payment secures this booking only");
    expect(html).toContain("Amount due today");
    expect(html).toContain("hidden md:block");
    expect(html).toContain("Pay with Paystack");
    expect(html).toContain("guest@example.com");
  });

  it("omits recurring section for once-off bookings", () => {
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
        extraRooms={0}
        cleaningIntensity="standard"
        equipmentSupply="customer"
        requestedTeamSize={1}
        propertySizeSqm={null}
        frequency="once"
        quote={quote.breakdown}
        customerEmail="guest@example.com"
      />,
    );

    expect(html).not.toContain("Recurring clean");
  });
});
