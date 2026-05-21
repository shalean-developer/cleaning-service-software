import type { Metadata } from "next";
import { MarketingHomePage } from "@/components/marketing/MarketingHomePage";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { MARKETING_IMAGES } from "@/features/marketing/constants";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import { buildHomePageJsonLd } from "@/features/marketing/seo";
import { getMarketingCanonicalUrl } from "@/features/marketing/siteUrl";

const HOME_TITLE = "Cleaning Services Cape Town from R250 | Shalean";
const HOME_DESCRIPTION =
  "Book trusted, insured Cape Town cleaners from R250. Regular, deep, move-in/out, Airbnb and office cleaning with instant quotes and secure online booking.";

export const metadata: Metadata = {
  ...buildMarketingMetadata({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
  }),
  keywords: [
    "cleaning services Cape Town",
    "home cleaning Cape Town",
    "house cleaners Cape Town",
    "deep cleaning services Cape Town",
    "deep cleaning Cape Town",
    "Airbnb cleaning Cape Town",
    "office cleaning Cape Town",
    "Shalean cleaning",
  ],
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    type: "website",
    locale: "en_ZA",
    url: getMarketingCanonicalUrl("/"),
    images: [
      {
        url: MARKETING_IMAGES.hero,
        width: 1200,
        height: 630,
        alt: MARKETING_IMAGES.heroAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [MARKETING_IMAGES.hero],
  },
};

export default function MarketingHomePageRoute() {
  const jsonLd = buildHomePageJsonLd();

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <MarketingHomePage />
    </>
  );
}
