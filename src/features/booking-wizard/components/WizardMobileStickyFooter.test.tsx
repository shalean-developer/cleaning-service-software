import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WIZARD_MOBILE_STICKY_FOOTER_CLASS } from "../wizardLayout";
import { WizardMobileStickyFooter } from "./WizardMobileStickyFooter";

describe("WizardMobileStickyFooter", () => {
  it("combines summary and nav in one mobile sticky footer", () => {
    const html = renderToStaticMarkup(
      <WizardMobileStickyFooter summary={<p>Summary</p>}>
        <button type="button">Continue</button>
      </WizardMobileStickyFooter>,
    );

    expect(html).toContain(WIZARD_MOBILE_STICKY_FOOTER_CLASS);
    expect(html).toContain("safe-area-inset-bottom");
    expect(html).toContain("Summary");
    expect(html).toContain("Continue");
    expect(html).toContain("md:static");
  });
});
