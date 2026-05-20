import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  AREAS_HUB_PATH,
  AREAS_PANEL,
  CAPE_TOWN_AREAS,
  MARKETING_IMAGES,
  PRICING_AUTHORITY_PATH,
  PRICING_PANEL,
  PRICING_PREVIEW,
  areaLocationPath,
} from "@/features/marketing/constants";
import { MarketingContainer } from "../MarketingContainer";
import { MarketingPanelCta } from "../MarketingPanelCta";
import { SectionEyebrow } from "../SectionEyebrow";

type FeaturePanelProps = {
  id: string;
  eyebrow: string;
  heading: string;
  subtitle: string;
  imageSrc: string;
  imageAlt: string;
  children: ReactNode;
  ctaHref: string;
  ctaLabel: string;
  panelIndex: number;
  /** Desktop: image on left (Areas) or right (Pricing). */
  imagePosition: "left" | "right";
};

function FeaturePanel({
  id,
  eyebrow,
  heading,
  subtitle,
  imageSrc,
  imageAlt,
  children,
  ctaHref,
  ctaLabel,
  panelIndex,
  imagePosition,
}: FeaturePanelProps) {
  const imageFirst = imagePosition === "left";

  return (
    <article
      id={id}
      className={`pricing-areas-panel group/panel relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)] lg:items-stretch ${
        imageFirst ? "flex-col-reverse lg:flex-row-reverse" : "lg:flex-row"
      }`}
      style={{ "--panel-index": panelIndex } as CSSProperties}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-shalean-soft-blue/20 via-transparent to-transparent opacity-60"
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col justify-between p-6 sm:p-7 lg:p-8">
        <div>
          <SectionEyebrow className="tracking-[0.12em] text-shalean-primary">
            {eyebrow}
          </SectionEyebrow>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl">
            {heading}
          </h3>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600">
            {subtitle}
          </p>
          <div className="mt-4">{children}</div>
        </div>

        <div className="mt-6">
          <MarketingPanelCta href={ctaHref}>{ctaLabel}</MarketingPanelCta>
        </div>
      </div>

      <div
        className={`relative z-10 h-36 shrink-0 overflow-hidden sm:h-40 lg:h-auto lg:min-h-0 lg:w-[42%] lg:self-stretch ${
          imageFirst ? "lg:border-r lg:border-slate-100/80" : "lg:border-l lg:border-slate-100/80"
        }`}
      >
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover object-center transition duration-[1.1s] ease-out group-hover/panel:scale-[1.04]"
          loading="lazy"
        />
        <div
          className={`pointer-events-none absolute inset-0 ${
            imageFirst
              ? "bg-gradient-to-r from-white/25 via-transparent to-transparent lg:from-white/40"
              : "bg-gradient-to-l from-white/25 via-transparent to-transparent lg:from-white/40"
          }`}
          aria-hidden
        />
      </div>
    </article>
  );
}

export function PricingAreasSection() {
  return (
    <section
      className="marketing-section relative overflow-hidden bg-shalean-surface !py-10 sm:!py-12"
      aria-labelledby="pricing-areas-heading"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-1/3 h-64 bg-[radial-gradient(ellipse_at_center,rgba(219,234,254,0.35)_0%,transparent_70%)]"
        aria-hidden
      />

      <MarketingContainer className="relative">
        <h2 id="pricing-areas-heading" className="sr-only">
          Pricing and service areas in Cape Town
        </h2>

        <div className="flex flex-col gap-8 lg:gap-10">
          <FeaturePanel
            id="pricing"
            eyebrow={PRICING_PANEL.eyebrow}
            heading={PRICING_PANEL.heading}
            subtitle={PRICING_PANEL.subtitle}
            imageSrc={MARKETING_IMAGES.pricingLifestyle}
            imageAlt="Bright, premium modern home interior after professional cleaning"
            ctaHref={PRICING_AUTHORITY_PATH}
            ctaLabel={PRICING_PANEL.ctaLabel}
            panelIndex={0}
            imagePosition="right"
          >
            <ul className="divide-y divide-slate-200/90">
              {PRICING_PREVIEW.map((item) => (
                <li
                  key={item.slug}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="text-sm font-medium text-shalean-navy sm:text-[0.9375rem]">
                    {item.name}
                  </span>
                  <span className="text-sm text-slate-600">
                    From{" "}
                    <span className="font-bold text-shalean-primary">{item.fromPrice}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-medium text-slate-500">
              {PRICING_PANEL.microcopy}
            </p>
          </FeaturePanel>

          <FeaturePanel
            id="areas"
            eyebrow={AREAS_PANEL.eyebrow}
            heading={AREAS_PANEL.heading}
            subtitle={AREAS_PANEL.subtitle}
            imageSrc={MARKETING_IMAGES.capeTownAerial}
            imageAlt="Aerial view of Cape Town with Table Mountain and the Atlantic coastline"
            ctaHref={AREAS_HUB_PATH}
            ctaLabel={AREAS_PANEL.ctaLabel}
            panelIndex={1}
            imagePosition="left"
          >
            <ul className="flex flex-wrap gap-2">
              {CAPE_TOWN_AREAS.map((area) => (
                <li key={area}>
                  <Link
                    href={areaLocationPath(area)}
                    className="marketing-focus-ring inline-flex min-h-9 items-center justify-center rounded-full border border-shalean-soft-blue/80 bg-shalean-soft-blue/50 px-3.5 py-1.5 text-xs font-medium text-shalean-primary transition duration-200 hover:border-shalean-primary/35 hover:bg-shalean-soft-blue sm:text-sm"
                  >
                    {area}
                  </Link>
                </li>
              ))}
            </ul>
          </FeaturePanel>
        </div>
      </MarketingContainer>
    </section>
  );
}
