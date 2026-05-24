import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  CORE_SERVICE_CATALOGUE,
  type CoreServiceCatalogueItem,
} from "@/features/services/catalog";
import { buildMarketingMetadata } from "@/features/marketing/metadata";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Book Cleaning Services Cape Town | Shalean",
  description:
    "Start a Shalean cleaning booking in Cape Town. Choose standard home cleaning, deep cleaning, move in/out, office, carpet, or post-construction cleaning.",
  path: "/book",
});

function ServiceCard({ service }: { service: CoreServiceCatalogueItem }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-shalean-navy">
            {service.title}
          </h2>
          <Badge variant={service.availableForBooking ? "success" : "warning"}>
            {service.availableForBooking ? "Book online" : "Request quote"}
          </Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {service.shortDescription}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="text-sm leading-6 text-slate-600">{service.displayCopy}</p>
        <div className="mt-auto flex flex-wrap gap-3 pt-6">
          {service.availableForBooking && service.bookingPath ? (
            <ButtonLink href={service.bookingPath} size="sm">
              Select service
            </ButtonLink>
          ) : (
            <ButtonLink href="/contact" size="sm" variant="secondary">
              Request quote
            </ButtonLink>
          )}
          <Link
            href={service.seoPath}
            className="marketing-focus-ring inline-flex h-9 items-center text-sm font-semibold text-shalean-primary hover:underline"
          >
            View details
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BookingStartPage() {
  return (
    <MarketingSeoShell>
      <section className="marketing-container py-12 sm:py-16 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-shalean-primary">
            Start a booking
          </p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-shalean-navy sm:text-4xl">
            Choose your cleaning service
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
            Pick a Shalean service for Cape Town. Bookable services continue into
            the secure customer flow; specialist quote services stay separate
            until pricing and operations are ready.
          </p>
        </div>

        <div className="mt-10 grid auto-rows-fr grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {CORE_SERVICE_CATALOGUE.map((service) => (
            <ServiceCard key={service.slug} service={service} />
          ))}
        </div>
      </section>
    </MarketingSeoShell>
  );
}
