import Link from "next/link";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { MarketingSeoPageLayout } from "@/components/marketing/MarketingSeoPageLayout";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { CONTACT_PAGE_PATH } from "@/features/marketing/marketing-routes";
import type { LegalPageContent } from "@/features/marketing/legal-pages";
import { buildBreadcrumbSchema, buildJsonLdGraph } from "@/features/marketing/seo";

type MarketingLegalPageProps = {
  content: LegalPageContent;
};

export function MarketingLegalPage({ content }: MarketingLegalPageProps) {
  const schema = buildJsonLdGraph([
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: content.h1, path: content.path },
    ]),
  ]);

  return (
    <MarketingSeoShell>
      <JsonLdScript data={schema} />
      <MarketingSeoPageLayout
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: content.h1 },
        ]}
        h1={content.h1}
        intro={content.intro}
      >
        <div className="mx-auto max-w-3xl space-y-10">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-3 text-base leading-relaxed text-slate-600"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
          <p className="text-sm text-slate-500">
            <Link
              href={CONTACT_PAGE_PATH}
              className="marketing-focus-ring font-medium text-shalean-primary hover:underline"
            >
              Contact Shalean Cleaning Services
            </Link>
          </p>
        </div>
      </MarketingSeoPageLayout>
    </MarketingSeoShell>
  );
}
