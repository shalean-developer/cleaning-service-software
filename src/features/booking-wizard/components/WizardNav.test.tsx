import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WizardNav } from "./WizardNav";

describe("WizardNav", () => {
  it("applies secure variant styling for checkout CTA", () => {
    const html = renderToStaticMarkup(
      <WizardNav
        continueLabel="Pay with Paystack"
        continueVariant="secure"
        onContinue={() => {}}
        showBack={false}
      />,
    );

    expect(html).toContain("py-3.5");
    expect(html).toContain("font-semibold");
    expect(html).toContain("shadow-[0_2px_10px");
  });
});
