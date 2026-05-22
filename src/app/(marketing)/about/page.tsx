import type { Metadata } from "next";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { MarketingBreadcrumbs } from "@/components/marketing/MarketingBreadcrumbs";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { AboutPageSections } from "@/components/marketing/about/AboutPageSections";
import {
  ABOUT_PAGE_FAQ,
  ABOUT_PAGE_H1,
  ABOUT_PAGE_META,
  ABOUT_PAGE_PATH,
} from "@/features/marketing/about-page";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import {
  buildAboutPageSchema,
  buildBreadcrumbSchema,
  buildFaqPageSchema,
  buildJsonLdGraph,
  buildLocalBusinessSchema,
  buildOrganizationSchema,
} from "@/features/marketing/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: ABOUT_PAGE_META.title,
  description: ABOUT_PAGE_META.description,
  path: ABOUT_PAGE_PATH,
  keywords: [...ABOUT_PAGE_META.keywords],
});

export default function AboutPage() {
  const schema = buildJsonLdGraph([
    buildOrganizationSchema({ description: ABOUT_PAGE_META.description }),
    buildLocalBusinessSchema({ description: ABOUT_PAGE_META.description }),
    buildAboutPageSchema({
      name: ABOUT_PAGE_H1,
      description: ABOUT_PAGE_META.description,
      path: ABOUT_PAGE_PATH,
    }),
    buildFaqPageSchema(ABOUT_PAGE_FAQ),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "About", path: ABOUT_PAGE_PATH },
    ]),
  ]);

  return (
    <MarketingSeoShell>
      <JsonLdScript data={schema} />
      <AboutPageSections
        heroAfterBreadcrumbs={
          <MarketingBreadcrumbs
            items={[
              { label: "Home", href: "/", icon: "home" },
              { label: "About" },
            ]}
          />
        }
      />
    </MarketingSeoShell>
  );
}
