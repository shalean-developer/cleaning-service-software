import type { Metadata } from "next";
import Link from "next/link";
import { MarketingBreadcrumbs } from "@/components/marketing/MarketingBreadcrumbs";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CORE_SERVICE_CATALOGUE_BY_SLUG } from "@/features/services/catalog";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import { SERVICES_HUB_PATH } from "@/features/marketing/seo-pages";

const service = CORE_SERVICE_CATALOGUE_BY_SLUG["post-construction-cleaning"];

export const metadata: Metadata = buildMarketingMetadata({
  title: "Post Construction Cleaning Cape Town | Shalean",
  description:
    "Route-ready Shalean post-construction cleaning page for Cape Town renovations, new builds, and handover-ready dust and residue cleanup.",
  path: service.seoPath,
});

export default function PostConstructionCleaningPage() {
  return (
    <MarketingSeoShell>
      <section className="bg-white">
        <div className="marketing-container py-10 sm:py-14 lg:py-16">
          <MarketingBreadcrumbs
            items={[
              { label: "Home", href: "/", icon: "home" },
              { label: "Services", href: SERVICES_HUB_PATH, icon: "services" },
              { label: service.title },
            ]}
          />

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-shalean-primary">
                Specialist cleaning
              </p>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-shalean-navy sm:text-4xl lg:text-5xl">
                Post Construction Cleaning in Cape Town
              </h1>
              <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg">
                {service.displayCopy}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/contact" size="lg">
                  Request a quote
                </ButtonLink>
                <ButtonLink href="/book" size="lg" variant="outline">
                  Compare services
                </ButtonLink>
              </div>
            </div>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-bold text-shalean-navy">Foundation status</h2>
              </CardHeader>
              <CardContent>
                <dl className="space-y-4 text-sm">
                  <div>
                    <dt className="font-semibold text-shalean-navy">Booking</dt>
                    <dd className="mt-1 text-slate-600">Quote request only</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-shalean-navy">Category</dt>
                    <dd className="mt-1 text-slate-600">Specialist cleaning</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-shalean-navy">Next phase</dt>
                    <dd className="mt-1 text-slate-600">
                      Add pricing, scope questions, and operations readiness before checkout.
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>

          <section className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              {
                title: "Builder dust removal",
                body: "Designed for fine dust and residue after renovations or fit-outs.",
              },
              {
                title: "Handover preparation",
                body: "A route-ready service page for homes, offices, and newly completed spaces.",
              },
              {
                title: "Scoped before checkout",
                body: "Kept out of instant checkout until pricing and operational rules are complete.",
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <h2 className="text-base font-bold text-shalean-navy">{item.title}</h2>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-slate-600">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <p className="mt-10 text-sm text-slate-600">
            Looking for a currently bookable service?{" "}
            <Link
              href="/book"
              className="marketing-focus-ring font-semibold text-shalean-primary hover:underline"
            >
              Start with the service selector
            </Link>
            .
          </p>
        </div>
      </section>
    </MarketingSeoShell>
  );
}
