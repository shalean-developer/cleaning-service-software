import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PastOffersCollapsible } from "./PastOffersCollapsible";

describe("PastOffersCollapsible", () => {
  it("renders collapsed details for past offers", () => {
    const html = renderToStaticMarkup(
      <PastOffersCollapsible count={2}>
        <p>Historical offers</p>
      </PastOffersCollapsible>,
    );
    expect(html).toContain("<details");
    expect(html).not.toMatch(/<details[^>]*\sopen[\s=>]/);
    expect(html).toContain("Past offers (2)");
    expect(html).toContain("Historical offers");
  });

  it("renders nothing when count is zero", () => {
    const html = renderToStaticMarkup(
      <PastOffersCollapsible count={0}>
        <p>Hidden</p>
      </PastOffersCollapsible>,
    );
    expect(html).toBe("");
  });
});
