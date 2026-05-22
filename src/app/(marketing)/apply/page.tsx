import type { Metadata } from "next";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { MarketingBreadcrumbs } from "@/components/marketing/MarketingBreadcrumbs";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { ApplyPageSections } from "@/components/marketing/apply/ApplyPageSections";
import {
  APPLY_PAGE_FAQ,
  APPLY_PAGE_H1,
  APPLY_PAGE_META,
  APPLY_PAGE_PATH,
} from "@/features/marketing/apply-page-content";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import {
  buildBreadcrumbSchema,
  buildFaqPageSchema,
  buildJsonLdGraph,
  buildLocalBusinessSchema,
  buildOrganizationSchema,
  buildWebPageSchema,
} from "@/features/marketing/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: APPLY_PAGE_META.title,
  description: APPLY_PAGE_META.description,
  path: APPLY_PAGE_PATH,
  keywords: [...APPLY_PAGE_META.keywords],
});

export default function ApplyPage() {
  const schema = buildJsonLdGraph([
    buildOrganizationSchema({ description: APPLY_PAGE_META.description }),
    buildLocalBusinessSchema({ description: APPLY_PAGE_META.description }),
    buildWebPageSchema({
      name: APPLY_PAGE_H1,
      description: APPLY_PAGE_META.description,
      path: APPLY_PAGE_PATH,
    }),
    buildFaqPageSchema(APPLY_PAGE_FAQ),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Apply", path: APPLY_PAGE_PATH },
    ]),
  ]);

  return (
    <MarketingSeoShell>
      <JsonLdScript data={schema} />
      <ApplyPageSections
        heroAfterBreadcrumbs={
          <MarketingBreadcrumbs
            items={[
              { label: "Home", href: "/", icon: "home" },
              { label: "Apply" },
            ]}
          />
        }
      />
    </MarketingSeoShell>
  );
}
