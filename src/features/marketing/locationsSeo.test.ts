import { describe, expect, it } from "vitest";
import { LOCATION_SEO_CONTENT } from "./seo-pages";
import { DEFAULT_MARKETING_SITE_URL } from "./siteUrl";
import {
  buildItemListSchema,
  buildJsonLdGraph,
  buildLocationSuburbWebPageSchema,
  buildLocationsHubWebPageSchema,
  buildOrganizationSchema,
} from "./seo";

describe("locations structured data", () => {
  it("uses unique WebPage @id per suburb", () => {
    const sea = buildLocationSuburbWebPageSchema(LOCATION_SEO_CONTENT["sea-point-cape-town"]!);
    const claremont = buildLocationSuburbWebPageSchema(
      LOCATION_SEO_CONTENT["claremont-cape-town"]!,
    );
    expect(sea["@id"]).toBe(`${DEFAULT_MARKETING_SITE_URL}/locations/sea-point-cape-town#webpage`);
    expect(claremont["@id"]).not.toBe(sea["@id"]);
  });

  it("suburb schema references organization, not duplicate LocalBusiness", () => {
    const page = buildLocationSuburbWebPageSchema(LOCATION_SEO_CONTENT["sea-point-cape-town"]!);
    expect(page["@type"]).toBe("WebPage");
    expect((page.about as { "@id": string })["@id"]).toBe(
      `${DEFAULT_MARKETING_SITE_URL}/#organization`,
    );
    expect((page.areaServed as { name: string }).name).toBe("Sea Point, Cape Town");
    expect(page["@id"]).not.toContain("#localbusiness");
  });

  it("hub ItemList includes all suburb canonical URLs", () => {
    const items = Object.values(LOCATION_SEO_CONTENT).map((c) => ({
      name: `Cleaning services in ${c.area}`,
      path: c.path,
    }));
    const list = buildItemListSchema(items);
    expect(list.itemListElement).toHaveLength(12);
    expect(list.itemListElement[0]?.position).toBe(1);
    expect(list.itemListElement[0]?.url).toContain("/locations/");
  });

  it("hub graph combines organization, collection page, and item list", () => {
    const graph = buildJsonLdGraph([
      buildOrganizationSchema(),
      buildLocationsHubWebPageSchema({
        name: "Cleaning Services Across Cape Town",
        description: "Test",
        path: "/locations",
      }),
      buildItemListSchema([{ name: "Test", path: "/locations/sea-point-cape-town" }]),
    ]);
    const types = graph["@graph"].map((n) => (n as { "@type": string })["@type"]);
    expect(types).toContain("Organization");
    expect(types).toContain("CollectionPage");
    expect(types).toContain("ItemList");
  });
});
