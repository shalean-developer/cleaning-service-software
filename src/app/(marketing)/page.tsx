import type { Metadata } from "next";
import { MarketingHomePage } from "@/components/marketing/MarketingHomePage";
import { buildHomePageJsonLd } from "@/features/marketing/seo";

export const metadata: Metadata = {
  title: "Professional Home Cleaning Services in Cape Town | Shalean",
  description:
    "Book trusted, vetted and insured cleaners in Cape Town. Regular, deep, move-in/out, Airbnb and office cleaning. Online booking in under 2 minutes. 4.9★ rated.",
  keywords: [
    "cleaning services Cape Town",
    "home cleaning Cape Town",
    "house cleaners Cape Town",
    "deep cleaning Cape Town",
    "Airbnb cleaning Cape Town",
    "office cleaning Cape Town",
    "Shalean cleaning",
  ],
  openGraph: {
    title: "Shalean Cleaning Services | Cape Town",
    description:
      "Premium professional cleaning in Cape Town. Book online in under 2 minutes.",
    type: "website",
    locale: "en_ZA",
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
