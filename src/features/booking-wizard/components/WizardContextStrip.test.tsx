import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardContextStrip } from "./WizardContextStrip";

describe("WizardContextStrip", () => {
  it("shows service in sky accent with home size and frequency when enabled", () => {
    const html = renderToStaticMarkup(
      <WizardContextStrip
        serviceLabel="Regular Cleaning"
        serviceSlug="regular-cleaning"
        bedrooms={2}
        bathrooms={1}
        propertySizeSqm={null}
        frequency="weekly"
        showHomeSize
        showFrequency
      />,
    );

    expect(html).toContain("text-sky-800");
    expect(html).toContain("Regular Cleaning");
    expect(html).toContain("2 beds");
    expect(html).toContain("1 bath");
    expect(html).toContain("Weekly");
  });

  it("omits frequency until enabled and shows sqm for office", () => {
    const html = renderToStaticMarkup(
      <WizardContextStrip
        serviceLabel="Office Cleaning"
        serviceSlug="office-cleaning"
        bedrooms={0}
        bathrooms={0}
        propertySizeSqm={120}
        frequency="once"
        showHomeSize
        showFrequency={false}
      />,
    );

    expect(html).toContain("120 sqm");
    expect(html).not.toContain("Once-off");
  });
});
