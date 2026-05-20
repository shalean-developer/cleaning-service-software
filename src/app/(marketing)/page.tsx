import type { Metadata } from "next";
import { MarketingHomePage } from "@/components/marketing/MarketingHomePage";
import { MARKETING_IMAGES } from "@/features/marketing/constants";
import { buildHomePageJsonLd } from "@/features/marketing/seo";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Professional Home Cleaning Services in Cape Town | Shalean",
  description:
    "Book trusted, vetted and insured cleaners in Cape Town. Regular, deep, move-in/out, Airbnb and office cleaning. Online booking in under 2 minutes.",
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
    title: "Professional Home Cleaning Services in Cape Town | Shalean",
    description:
      "Trusted home and deep cleaning in Cape Town. Vetted cleaners, instant quotes, and online booking.",
    type: "website",
    locale: "en_ZA",
    url: "/",
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
    title: "Shalean Cleaning Services | Cape Town",
    description: "Professional home cleaning services in Cape Town. Book online in minutes.",
    images: [MARKETING_IMAGES.hero],
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function MarketingHomePageRoute() {
  const jsonLd = buildHomePageJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingHomePage />
    </>
  );
}
