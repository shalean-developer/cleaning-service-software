import Image from "next/image";
import { MARKETING_IMAGES, PRICING_PREVIEW } from "@/features/marketing/constants";
import { MarketingButton } from "../MarketingButton";
import { SectionHeading } from "../SectionHeading";

export function PricingPreviewSection() {
  return (
    <section id="pricing" className="bg-shalean-surface py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Transparent pricing"
          title="Simple, Honest Pricing"
          description="Clear starting prices for every service. Get a personalised quote when you book online."
        />

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-xl lg:aspect-auto lg:min-h-[28rem]">
            <Image
              src={MARKETING_IMAGES.pricingLifestyle}
              alt="Professional cleaner preparing supplies"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          <div className="rounded-3xl border border-shalean-border bg-white p-8 shadow-lg sm:p-10">
            <ul className="divide-y divide-shalean-border">
              {PRICING_PREVIEW.map((item) => (
                <li
                  key={item.slug}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <span className="font-medium text-shalean-navy">{item.name}</span>
                  <span className="shrink-0 text-sm text-slate-500">
                    from{" "}
                    <span className="text-lg font-bold text-shalean-primary">{item.fromPrice}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-slate-500">
              Prices shown are starting rates for standard homes. Final quote depends on size,
              add-ons, and frequency.
            </p>
            <MarketingButton
              href="/sign-up?redirectedFrom=/customer/book"
              variant="primary"
              className="mt-8 w-full sm:w-auto"
            >
              View Full Pricing
            </MarketingButton>
          </div>
        </div>
      </div>
    </section>
  );
}
