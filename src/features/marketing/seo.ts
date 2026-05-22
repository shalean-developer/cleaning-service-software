import {
  BUSINESS_HOURS,
  FAQ_ITEMS,
  MARKETING_SERVICES,
  SERVICE_SEO_PATHS,
  SHALEAN_CONTACT,
} from "./constants";
import { getMarketingCanonicalUrl, getMarketingSiteUrl } from "./siteUrl";
import type { LocationSeoContent, ServiceSeoContent } from "./seo-pages";

type FaqItem = { question: string; answer: string };

const ORGANIZATION_NAME = "Shalean Cleaning Services";

/** Wrap multiple schema nodes in a single JSON-LD graph (one script tag). */
export function buildJsonLdGraph(nodes: object[]): { "@context": string; "@graph": object[] } {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.map((node) => {
      const copy = { ...node } as Record<string, unknown>;
      delete copy["@context"];
      return copy;
    }),
  };
}

export function buildLocalBusinessSchema(options?: {
  name?: string;
  description?: string;
  url?: string;
}) {
  const siteUrl = getMarketingSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${siteUrl}/#localbusiness`,
    name: options?.name ?? ORGANIZATION_NAME,
    description:
      options?.description ??
      "Professional home cleaning, deep cleaning, and Airbnb cleaning in Cape Town. Vetted, insured cleaners with online booking and transparent pricing.",
    url: options?.url ?? siteUrl,
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
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ],
        opens: "07:00",
        closes: "19:00",
      },
    ],
    openingHours: BUSINESS_HOURS,
    priceRange: "R$$",
  };
}

export function buildWebSiteSchema() {
  const siteUrl = getMarketingSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: ORGANIZATION_NAME,
    url: siteUrl,
    inLanguage: "en-ZA",
    publisher: {
      "@type": "LocalBusiness",
      "@id": `${siteUrl}/#localbusiness`,
      name: ORGANIZATION_NAME,
    },
  };
}

export function buildFaqPageSchema(items: readonly FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildBreadcrumbSchema(
  items: { name: string; path: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getMarketingCanonicalUrl(item.path),
    })),
  };
}

export function buildServiceSchema(content: ServiceSeoContent) {
  const siteUrl = getMarketingSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: content.h1,
    description: content.intro,
    provider: {
      "@type": "LocalBusiness",
      "@id": `${siteUrl}/#localbusiness`,
      name: ORGANIZATION_NAME,
      url: siteUrl,
    },
    areaServed: {
      "@type": "City",
      name: "Cape Town",
    },
    url: getMarketingCanonicalUrl(content.path),
  };
}

/** @deprecated Suburb pages use buildLocationSuburbWebPageSchema. avoids duplicate LocalBusiness @id. */
export function buildLocationBusinessSchema(content: LocationSeoContent) {
  return buildLocalBusinessSchema({
    description: `${content.intro} ${content.localNote}`,
    url: getMarketingCanonicalUrl(content.path),
  });
}

/** Suburb location page: unique WebPage entity linked to global Organization (no branch offices). */
export function buildLocationSuburbWebPageSchema(content: LocationSeoContent) {
  const siteUrl = getMarketingSiteUrl();
  const pageUrl = getMarketingCanonicalUrl(content.path);
  const description = `${content.intro} ${content.localNote}`.trim();

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: content.h1,
    description,
    inLanguage: "en-ZA",
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
    },
    about: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: ORGANIZATION_NAME,
    },
    mainEntity: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
    },
    areaServed: {
      "@type": "Place",
      name: `${content.area}, Cape Town`,
      address: {
        "@type": "PostalAddress",
        addressLocality: content.area,
        addressRegion: "Western Cape",
        addressCountry: "ZA",
      },
    },
  };
}

/** Locations hub: collection page for the Cape Town service-area directory. */
export function buildLocationsHubWebPageSchema(options: {
  name: string;
  description: string;
  path: string;
}) {
  const siteUrl = getMarketingSiteUrl();
  const pageUrl = getMarketingCanonicalUrl(options.path);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: options.name,
    description: options.description,
    inLanguage: "en-ZA",
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
    },
    about: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: ORGANIZATION_NAME,
    },
    areaServed: {
      "@type": "City",
      name: "Cape Town",
    },
  };
}

export function buildOrganizationSchema(options?: { description?: string }) {
  const siteUrl = getMarketingSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: ORGANIZATION_NAME,
    url: siteUrl,
    logo: `${siteUrl}/marketing/shalean-logo.png`,
    description:
      options?.description ??
      "Cape Town home services platform for professional cleaning, recurring home care, and Airbnb turnovers.",
    areaServed: {
      "@type": "City",
      name: "Cape Town",
    },
  };
}

export function buildWebPageSchema(options: {
  name: string;
  description: string;
  path: string;
}) {
  const siteUrl = getMarketingSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: options.name,
    description: options.description,
    url: getMarketingCanonicalUrl(options.path),
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
    },
    about: {
      "@type": "LocalBusiness",
      "@id": `${siteUrl}/#localbusiness`,
    },
  };
}

export function buildAboutPageSchema(options: {
  name: string;
  description: string;
  path: string;
}) {
  const siteUrl = getMarketingSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: options.name,
    description: options.description,
    url: getMarketingCanonicalUrl(options.path),
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
    },
    about: {
      "@type": "LocalBusiness",
      "@id": `${siteUrl}/#localbusiness`,
      name: ORGANIZATION_NAME,
    },
  };
}

export function buildCollectionPageSchema(options: {
  name: string;
  description: string;
  path: string;
}) {
  const siteUrl = getMarketingSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: options.name,
    description: options.description,
    url: getMarketingCanonicalUrl(options.path),
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
    },
  };
}

export function buildItemListSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: getMarketingCanonicalUrl(item.path),
    })),
  };
}

/** Homepage: LocalBusiness, WebSite, FAQPage, and service directory ItemList. */
export function buildHomePageJsonLd() {
  const serviceListItems = MARKETING_SERVICES.map((service) => ({
    name: service.title,
    path: SERVICE_SEO_PATHS[service.slug],
  }));

  return buildJsonLdGraph([
    buildLocalBusinessSchema(),
    buildWebSiteSchema(),
    buildFaqPageSchema(FAQ_ITEMS),
    buildItemListSchema(serviceListItems),
  ]);
}
