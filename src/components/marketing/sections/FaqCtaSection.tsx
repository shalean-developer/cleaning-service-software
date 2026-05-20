import Image from "next/image";
import Link from "next/link";
import {
  BOOKING_PATH,
  BOOKING_SIGNUP_HINT,
  FAQ_SECTION,
  FAQ_ITEMS,
  FINAL_CTA_SECTION,
  MARKETING_IMAGES,
  SHALEAN_CONTACT,
} from "@/features/marketing/constants";
import { FaqAccordion } from "../FaqAccordion";
import { IconCheck, IconWhatsApp } from "../icons";
import { MarketingContainer } from "../MarketingContainer";
import { MarketingSectionLink } from "../MarketingSectionLink";
import { SectionEyebrow } from "../SectionEyebrow";

function faqJsonLd() {
  return {
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
}

export function FaqCtaSection() {
  const whatsappUrl = `https://wa.me/${SHALEAN_CONTACT.whatsappNumber}?text=${encodeURIComponent("Hi Shalean, I have a question about booking a cleaning.")}`;
  const jsonLd = faqJsonLd();

  return (
    <section
      className="marketing-section relative bg-shalean-surface !py-12 sm:!py-14"
      aria-labelledby="faq-heading"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <MarketingContainer>
        <div id="faq" className="mx-auto max-w-3xl">
          <header className="text-center">
            <SectionEyebrow className="tracking-[0.14em] text-shalean-primary">
              {FAQ_SECTION.eyebrow}
            </SectionEyebrow>
            <h2
              id="faq-heading"
              className="mt-4 text-3xl font-bold tracking-tight text-shalean-navy sm:text-4xl"
            >
              {FAQ_SECTION.heading}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              {FAQ_SECTION.subtitle}
            </p>
          </header>

          <FaqAccordion />

          <p className="mt-8 text-center text-sm text-slate-600">
            {FAQ_SECTION.helpText}{" "}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="marketing-focus-ring font-semibold text-shalean-primary hover:text-blue-600"
            >
              WhatsApp us
            </a>{" "}
            or{" "}
            <MarketingSectionLink
              sectionId="contact"
              className="marketing-focus-ring font-semibold text-shalean-primary hover:text-blue-600"
            >
              get in touch
            </MarketingSectionLink>
            .
          </p>
        </div>

        <article
          className="marketing-final-cta group/cta relative mt-12 flex flex-col overflow-hidden rounded-3xl border border-blue-200/40 shadow-[0_12px_48px_rgba(37,99,235,0.15)] sm:mt-14 lg:mt-16 lg:min-h-[20rem] lg:flex-row lg:items-stretch"
          aria-labelledby="final-cta-heading"
        >
          <div className="marketing-cta-panel relative z-10 flex flex-1 flex-col justify-center gap-6 p-8 sm:p-10 lg:p-12 lg:max-w-[58%]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">
                {FINAL_CTA_SECTION.eyebrow}
              </p>
              <h3
                id="final-cta-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-[2rem] lg:leading-tight"
              >
                {FINAL_CTA_SECTION.heading}
              </h3>
              <p className="mt-3 max-w-lg text-[0.9375rem] leading-relaxed text-white/90 sm:text-base">
                {FINAL_CTA_SECTION.subtitle}
              </p>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-2.5">
              {FINAL_CTA_SECTION.trustPoints.map((point) => (
                <li key={point} className="flex items-center gap-2.5 text-sm text-white/92">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <IconCheck className="h-3.5 w-3.5 text-sky-100" aria-hidden />
                  </span>
                  {point}
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href={BOOKING_PATH}
                className="marketing-focus-ring inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-shalean-primary shadow-[0_4px_20px_rgba(15,23,42,0.12)] transition duration-200 hover:bg-blue-50"
              >
                Book Now
              </Link>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="marketing-focus-ring inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/45 bg-white/10 px-7 text-sm font-semibold text-white backdrop-blur-sm transition duration-200 hover:bg-white/20"
              >
                <IconWhatsApp className="h-5 w-5" aria-hidden />
                WhatsApp Us
              </a>
            </div>
            <p className="text-xs leading-relaxed text-white/75">{BOOKING_SIGNUP_HINT}</p>
          </div>

          <div className="relative h-48 shrink-0 overflow-hidden sm:h-56 lg:h-auto lg:min-h-0 lg:w-[42%] lg:self-stretch">
            <Image
              src={MARKETING_IMAGES.finalCta}
              alt={MARKETING_IMAGES.finalCtaAlt}
              fill
              sizes="(max-width: 1024px) 100vw, 42vw"
              className="object-cover object-center transition duration-700 ease-out group-hover/cta:scale-[1.03]"
              loading="lazy"
            />
            <div className="marketing-cta-panel-image-overlay pointer-events-none absolute inset-0 lg:bg-gradient-to-l lg:from-[#1d4ed8]/90 lg:via-[#1d4ed8]/40 lg:to-transparent" />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1d4ed8]/80 via-transparent to-transparent lg:hidden"
              aria-hidden
            />
          </div>
        </article>
      </MarketingContainer>
    </section>
  );
}
