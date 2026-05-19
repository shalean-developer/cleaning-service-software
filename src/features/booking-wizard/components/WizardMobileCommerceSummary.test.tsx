import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WIZARD_STICKY_FOOTER_SUMMARY_SLOT_CLASS } from "../wizardLayout";
import {
  CheckoutMobileCommerceSummary,
  ReviewMobileCommerceSummary,
} from "./WizardMobileCommerceSummary";

describe("WizardMobileCommerceSummary", () => {
  it("renders review summary only on mobile", () => {
    const html = renderToStaticMarkup(
      <ReviewMobileCommerceSummary totalCents={53_100} />,
    );

    expect(html).toContain("Total");
    expect(html).toContain(WIZARD_STICKY_FOOTER_SUMMARY_SLOT_CLASS);
    expect(html).toMatch(/R[\s\u00a0]531[,.]00/);
  });

  it("renders checkout amount due today only on mobile", () => {
    const html = renderToStaticMarkup(
      <CheckoutMobileCommerceSummary totalCents={59_000} />,
    );

    expect(html).toContain("Amount due today");
    expect(html).toContain(WIZARD_STICKY_FOOTER_SUMMARY_SLOT_CLASS);
  });
});
