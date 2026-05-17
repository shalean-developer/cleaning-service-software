import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OfferExpiryChip } from "./OfferExpiryChip";

describe("OfferExpiryChip", () => {
  it("renders relative label with accessible aria-label", () => {
    const html = renderToStaticMarkup(
      <OfferExpiryChip
        relativeLabel="Respond within 45m"
        ariaLabel="Respond within 45m. Expires Mon 19 May, 14:30"
        urgency="warning"
      />,
    );
    expect(html).toContain("Respond within 45m");
    expect(html).toContain('aria-label="Respond within 45m. Expires Mon 19 May, 14:30"');
    expect(html).toContain("bg-amber-100");
  });
});
