import type { Metadata } from "next";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { MarketingBookCta } from "@/components/marketing/MarketingBookCta";
import { MarketingInternalLinks } from "@/components/marketing/MarketingInternalLinks";
import { MarketingSeoPageLayout } from "@/components/marketing/MarketingSeoPageLayout";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { SERVICE_SEO_PATHS } from "@/features/marketing/constants";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import { FAQ_PAGE_ITEMS, FAQ_PAGE_PATH } from "@/features/marketing/seo-pages";
import {
  buildBreadcrumbSchema,
  buildFaqPageSchema,
  buildJsonLdGraph,
} from "@/features/marketing/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Cleaning Service FAQs | Shalean Cape Town",
  description:
    "Answers about Shalean cleaning prices, bookings, same-day service, supplies, Cape Town areas, payments, and cancellations.",
  path: FAQ_PAGE_PATH,
});

export default function FaqPage() {
  const schema = buildJsonLdGraph([
    buildFaqPageSchema(FAQ_PAGE_ITEMS),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "FAQ", path: FAQ_PAGE_PATH },
    ]),
  ]);

  return (
    <MarketingSeoShell>
      <JsonLdScript data={schema} />
      <MarketingSeoPageLayout
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "FAQ" },
        ]}
        h1="Frequently Asked Questions"
        intro="Everything you need to know before booking professional cleaning in Cape Town — pricing, scheduling, supplies, and service areas."
        afterIntro={<MarketingBookCta />}
      >
        <div className="mx-auto max-w-3xl">
          <FaqAccordion items={FAQ_PAGE_ITEMS} />
        </div>
        <MarketingInternalLinks
          servicePaths={Object.values(SERVICE_SEO_PATHS).slice(0, 4)}
          showPricing
        />
      </MarketingSeoPageLayout>
    </MarketingSeoShell>
  );
}
