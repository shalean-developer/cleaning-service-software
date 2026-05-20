import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DetailsExtrasDisclosure } from "./DetailsExtrasDisclosure";

describe("DetailsExtrasDisclosure", () => {
  it("collapses extras behind Add extras summary", () => {
    const html = renderToStaticMarkup(
      <DetailsExtrasDisclosure serviceSlug="regular-cleaning" selected={[]}>
        <p>Extras content</p>
      </DetailsExtrasDisclosure>,
    );
    expect(html).toContain("<details");
    expect(html).toContain("Add extras");
    expect(html).toContain("Extras content");
  });

  it("opens when addons are selected and shows count in summary", () => {
    const html = renderToStaticMarkup(
      <DetailsExtrasDisclosure serviceSlug="regular-cleaning" selected={["inside-fridge"]}>
        <p>Extras content</p>
      </DetailsExtrasDisclosure>,
    );
    expect(html).toContain("open");
    expect(html).toMatch(/\(1 selected\)/i);
    expect(html).toContain("open");
  });
});
