import type { MetadataRoute } from "next";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { SERVICE_SEO_PATHS } from "./constants";
import { LEGAL_PAGE_PATHS } from "./legal-pages";
import {
  CONTACT_PAGE_PATH,
  FAQ_PAGE_PATH,
  REVIEWS_PAGE_PATH,
} from "./marketing-routes";
import { LOCATION_SEO_SLUGS } from "./marketing-routes";
import { getMarketingSiteUrl } from "./siteUrl";

/** Public pricing hub URL. */
export const PRICING_SITEMAP_PATH = "/cleaning-prices-cape-town" as const;

const SITEMAP_SERVICE_SLUGS = [
  "regular-cleaning",
  "deep-cleaning",
  "moving-cleaning",
  "airbnb-cleaning",
  "office-cleaning",
  "carpet-cleaning",
] as const satisfies readonly ServiceSlug[];

const SERVICE_PRIORITY: Partial<Record<(typeof SITEMAP_SERVICE_SLUGS)[number], number>> = {
  "office-cleaning": 0.8,
  "carpet-cleaning": 0.8,
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

  const locationEntries: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/locations`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    ...LOCATION_SEO_SLUGS.map((slug) => ({
      url: `${baseUrl}/locations/${slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

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
      url: `${baseUrl}${FAQ_PAGE_PATH}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}${CONTACT_PAGE_PATH}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}${REVIEWS_PAGE_PATH}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...LEGAL_PAGE_PATHS.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
    ...locationEntries,
  ];
}

/** Expected sitemap entry count for tests (homepage + static + services + locations + legal). */
export const SITEMAP_ENTRY_COUNT =
  1 +
  1 +
  SITEMAP_SERVICE_SLUGS.length +
  3 +
  LEGAL_PAGE_PATHS.length +
  1 +
  LOCATION_SEO_SLUGS.length;
