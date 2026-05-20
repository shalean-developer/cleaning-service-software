import { FAQ_ITEMS, SHALEAN_CONTACT } from "./constants";

export function buildHomePageJsonLd() {
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Shalean Cleaning Services",
    description:
      "Professional home and office cleaning services in Cape Town, South Africa. Vetted cleaners, online booking, and satisfaction guarantee.",
    url: "https://shalean.co.za",
    telephone: SHALEAN_CONTACT.phoneE164,
    email: SHALEAN_CONTACT.email,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Cape Town",
      addressRegion: "Western Cape",
      addressCountry: "ZA",
    },
    areaServed: {
      "@type": "City",
      name: "Cape Town",
    },
    priceRange: "R$$",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "1200",
      bestRating: "5",
    },
  };

  return [localBusiness, faqPage];
}
