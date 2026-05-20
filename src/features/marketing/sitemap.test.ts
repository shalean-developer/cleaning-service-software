import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SERVICE_SEO_PATHS } from "./constants";
import { buildMarketingSitemap, PRICING_SITEMAP_PATH } from "./sitemap";
import { DEFAULT_MARKETING_SITE_URL } from "./siteUrl";

describe("buildMarketingSitemap", () => {
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
  });

  it("lists public marketing URLs without hash fragments", () => {
    const entries = buildMarketingSitemap();
    const urls = entries.map((e) => e.url);

    expect(urls[0]).toBe(DEFAULT_MARKETING_SITE_URL);
    expect(urls.some((u) => u.endsWith(PRICING_SITEMAP_PATH))).toBe(true);
    expect(urls.some((u) => u.endsWith(SERVICE_SEO_PATHS["regular-cleaning"]))).toBe(true);
    expect(urls.some((u) => u.endsWith("/faq"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/contact"))).toBe(true);
    expect(urls.every((u) => !u.includes("#"))).toBe(true);
    expect(urls).toHaveLength(9);
  });
});
