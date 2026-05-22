import type { Metadata } from "next";
import { getMarketingCanonicalUrl, getMarketingSiteUrl } from "./siteUrl";

export const SHALEAN_METADATA_TITLE_DEFAULT = "Shalean Cleaning Services";
export const SHALEAN_METADATA_TITLE_TEMPLATE = "%s | Shalean";

type BuildMarketingMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
};

/** Canonical marketing page metadata with production-safe defaults. */
export function buildMarketingMetadata({
  title,
  description,
  path,
  keywords,
}: BuildMarketingMetadataOptions): Metadata {
  const siteUrl = getMarketingSiteUrl();
  const canonicalPath = path.startsWith("/") ? path : `/${path}`;
  const canonicalUrl = getMarketingCanonicalUrl(canonicalPath);

  return {
    metadataBase: new URL(siteUrl),
    title: { absolute: title },
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "en_ZA",
      url: canonicalUrl,
      siteName: "Shalean",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

/** Conversion/form pages. allow follow links, omit from sitemap. */
export function buildMarketingNoindexMetadata({
  title,
  description,
  path,
}: BuildMarketingMetadataOptions): Metadata {
  const base = buildMarketingMetadata({ title, description, path });
  return {
    ...base,
    robots: {
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    },
  };
}

/** Dashboard and auth surfaces. keep out of public search indexes. */
export const PLATFORM_NOINDEX_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};
