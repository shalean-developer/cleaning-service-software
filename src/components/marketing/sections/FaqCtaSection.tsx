import Image from "next/image";
import Link from "next/link";
import { BOOKING_PATH, MARKETING_IMAGES, SHALEAN_CONTACT } from "@/features/marketing/constants";
import { FaqAccordion } from "../FaqAccordion";
import { IconCheck, IconWhatsApp } from "../icons";
import { MarketingButton } from "../MarketingButton";
import { MarketingContainer } from "../MarketingContainer";
import { SectionEyebrow } from "../SectionEyebrow";

const CTA_TRUST = [
  "Same-Day Service",
  "Satisfaction Guarantee",
  "Trusted Cleaners",
] as const;

export function FaqCtaSection() {
  const whatsappUrl = `https://wa.me/${SHALEAN_CONTACT.whatsappNumber}?text=${encodeURIComponent("Hi Shalean, I'm ready to book a cleaning.")}`;

  return (
    <section
      className="marketing-section !py-12 bg-shalean-surface lg:!py-14"
      aria-labelledby="faq-heading"
    >
      <MarketingContainer>
        <div className="grid gap-6 lg:grid-cols-[7fr_13fr] lg:items-end lg:gap-0">
          <div
            id="faq"
            className="rounded-3xl border border-shalean-border bg-white p-6 marketing-card-shadow lg:rounded-r-none lg:border-r-0 lg:p-7"
          >
            <SectionEyebrow>FAQs</SectionEyebrow>
            <h2
              id="faq-heading"
              className="mt-2 text-xl font-bold text-shalean-navy md:text-2xl"
            >
              Frequently Asked Questions
            </h2>
            <FaqAccordion />
            <Link
              href="#faq"
              className="mt-4 inline-flex items-center text-sm font-semibold text-shalean-primary hover:text-blue-600"
            >
              View more
              <span className="ml-1" aria-hidden>
                →
              </span>
            </Link>
          </div>

          <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-shalean-primary via-blue-600 to-blue-700 marketing-card-shadow lg:rounded-l-none">
            <div className="relative z-10 flex flex-col gap-4 p-6 sm:p-8 lg:max-w-[72%]">
              <div>
                <h2 className="max-w-2xl text-2xl font-bold text-white md:text-3xl">
                  Ready for a Cleaner Home?
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100 md:text-base">
                  Book online in less than 2 minutes and let us take
                  <br />
                  care of the cleaning.
                </p>
              </div>

              <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
                {CTA_TRUST.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm text-blue-50">
                    <IconCheck className="h-4 w-4 shrink-0 text-shalean-sky" />
                    {point}
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-3">
                <MarketingButton
                  href={BOOKING_PATH}
                  variant="white"
                  className="!h-11 !min-w-[10rem] !rounded-[13px]"
                >
                  Book Now →
                </MarketingButton>
                <MarketingButton
                  href={whatsappUrl}
                  variant="secondary"
                  external
                  className="!h-11 !min-w-[10rem] !rounded-[13px] !border-white/50 !bg-transparent !text-white hover:!bg-white/10"
                >
                  <IconWhatsApp className="h-5 w-5 text-white" />
                  WhatsApp Us
                </MarketingButton>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] lg:block">
              <Image
                src={MARKETING_IMAGES.finalCta}
                alt="Clean minimalist living room with grey sofa and potted plant"
                fill
                sizes="420px"
                loading="lazy"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent via-blue-600/40 to-blue-700/90" />
            </div>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}
