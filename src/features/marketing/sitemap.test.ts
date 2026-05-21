import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SERVICE_SEO_PATHS } from "./constants";
import {
  buildMarketingSitemap,
  PRICING_SITEMAP_PATH,
  SITEMAP_ENTRY_COUNT,
} from "./sitemap";
import { DEFAULT_MARKETING_SITE_URL } from "./siteUrl";

describe("buildMarketingSitemap", () => {
  const prevMarketing = process.env.NEXT_PUBLIC_MARKETING_SITE_URL;
  const prevAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_MARKETING_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (prevMarketing === undefined) delete process.env.NEXT_PUBLIC_MARKETING_SITE_URL;
    else process.env.NEXT_PUBLIC_MARKETING_SITE_URL = prevMarketing;
    if (prevAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prevAppUrl;
  });

  it("lists public marketing URLs without hash fragments", () => {
    const entries = buildMarketingSitemap();
    const urls = entries.map((e) => e.url);

    expect(urls[0]).toBe(DEFAULT_MARKETING_SITE_URL);
    expect(urls.some((u) => u.endsWith(PRICING_SITEMAP_PATH))).toBe(true);
    expect(urls.some((u) => u.endsWith(SERVICE_SEO_PATHS["regular-cleaning"]))).toBe(true);
    expect(urls.some((u) => u.endsWith(SERVICE_SEO_PATHS["carpet-cleaning"]))).toBe(true);
    expect(urls.some((u) => u.endsWith("/faq"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/contact"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/reviews"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/locations"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/locations/sea-point-cape-town"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/terms"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/privacy"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/refund-policy"))).toBe(true);
    expect(urls.every((u) => !u.includes("#"))).toBe(true);
    expect(urls).toHaveLength(SITEMAP_ENTRY_COUNT);
  });

  it("never emits localhost or Vercel preview URLs when APP_URL is local", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    const urls = buildMarketingSitemap().map((e) => e.url);

    expect(urls.every((u) => u.startsWith(DEFAULT_MARKETING_SITE_URL))).toBe(true);
    expect(urls.some((u) => u.includes("localhost"))).toBe(false);
    expect(urls.some((u) => u.includes("vercel.app"))).toBe(false);
  });
});
