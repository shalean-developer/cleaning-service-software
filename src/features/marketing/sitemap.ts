import type { MetadataRoute } from "next";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { SERVICE_SEO_PATHS } from "./constants";
import { getMarketingSiteUrl } from "./siteUrl";

/** Public pricing hub URL (sitemap; page may be added later). */
export const PRICING_SITEMAP_PATH = "/cleaning-prices-cape-town" as const;

const SITEMAP_SERVICE_SLUGS = [
  "regular-cleaning",
  "deep-cleaning",
  "moving-cleaning",
  "airbnb-cleaning",
  "office-cleaning",
] as const satisfies readonly ServiceSlug[];

const SERVICE_PRIORITY: Partial<Record<(typeof SITEMAP_SERVICE_SLUGS)[number], number>> = {
  "office-cleaning": 0.8,
};

export function buildMarketingSitemap(): MetadataRoute.Sitemap {
  const baseUrl = getMarketingSiteUrl();
  const lastModified = new Date();

  const serviceEntries: MetadataRoute.Sitemap = SITEMAP_SERVICE_SLUGS.map((slug) => ({
    url: `${baseUrl}${SERVICE_SEO_PATHS[slug]}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: SERVICE_PRIORITY[slug] ?? 0.9,
  }));

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}${PRICING_SITEMAP_PATH}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...serviceEntries,
    {
      url: `${baseUrl}/faq`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
