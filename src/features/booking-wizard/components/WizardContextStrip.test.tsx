import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { showFrequencyForService } from "../frequencyVisibility";
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

  it("hides frequency chip for deep cleaning even when showFrequency is true", () => {
    expect(showFrequencyForService("deep-cleaning")).toBe(false);

    const html = renderToStaticMarkup(
      <WizardContextStrip
        serviceLabel="Deep Cleaning"
        serviceSlug="deep-cleaning"
        bedrooms={2}
        bathrooms={1}
        propertySizeSqm={null}
        frequency="weekly"
        showHomeSize
        showFrequency
      />,
    );

    expect(html).not.toContain("Weekly");
  });

  it("shows frequency on schedule step when showFrequency is enabled", () => {
    const html = renderToStaticMarkup(
      <WizardContextStrip
        serviceLabel="Regular Cleaning"
        serviceSlug="regular-cleaning"
        bedrooms={2}
        bathrooms={1}
        propertySizeSqm={null}
        frequency="biweekly"
        showHomeSize={false}
        showFrequency
      />,
    );

    expect(html).toContain("Regular Cleaning");
    expect(html).toContain("Bi-weekly");
    expect(html).not.toContain("2 beds");
  });

  it("omits frequency until enabled and shows office sizing for office", () => {
    const html = renderToStaticMarkup(
      <WizardContextStrip
        serviceLabel="Office Cleaning"
        serviceSlug="office-cleaning"
        bedrooms={0}
        bathrooms={0}
        propertySizeSqm={120}
        officeSizeTier="medium"
        officeWorkstations="15"
        frequency="once"
        showHomeSize
        showFrequency={false}
      />,
    );

    expect(html).toContain("Medium office");
    expect(html).toContain("15 workstations");
    expect(html).not.toContain("sqm");
    expect(html).not.toContain("Once-off");
  });
});
