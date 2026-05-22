import Link from "next/link";
import {
  BOOKING_PATH,
  HOMEPAGE_HERO_SUBTITLE,
  MARKETING_NAV_PATHS,
  SHALEAN_CONTACT,
} from "@/features/marketing/constants";
import { HeroBookingCard } from "../HeroBookingCard";
import { IconCalendar, IconMapPin, IconWhatsApp } from "../icons";
import { MarketingButton } from "../MarketingButton";
import { MarketingContainer } from "../MarketingContainer";

export function HeroSection() {
  const whatsappUrl = `https://wa.me/${SHALEAN_CONTACT.whatsappNumber}?text=${encodeURIComponent("Hi Shalean, I'd like to book a cleaning.")}`;

  return (
    <section
      className="marketing-hero relative overflow-hidden"
      aria-label="Hero"
    >
      <div
        className="absolute inset-0 bg-gradient-to-b from-white via-[#fafbfd] to-[#f3f7fd]"
        aria-hidden
      />

      <div className="relative z-10 pt-[var(--marketing-header-height)]">
        <MarketingContainer className="flex flex-col justify-start pb-6 pt-6 sm:pb-8 sm:pt-8 lg:pb-10 lg:pt-10">
          <div className="grid items-center gap-12 sm:gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-x-16 lg:gap-y-0 xl:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] xl:gap-x-20">
            <div className="flex max-w-[40rem] flex-col justify-center lg:pr-4 xl:max-w-[42rem]">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5 font-semibold text-shalean-navy">
                  <IconMapPin className="h-4 w-4 shrink-0" aria-hidden />
                  Cape Town, ZA
                </span>
                <Link
                  href={MARKETING_NAV_PATHS.locations}
                  className="marketing-focus-ring font-normal text-shalean-navy underline decoration-slate-400 underline-offset-[3px] transition hover:decoration-shalean-navy"
                >
                  Change location
                </Link>
              </div>

              <h1 className="mt-5 text-[2rem] font-extrabold leading-[1.08] tracking-[-0.02em] text-shalean-navy sm:mt-6 sm:text-[2.75rem] lg:mt-7 lg:text-[3.25rem] xl:text-[3.5rem]">
                Professional Cleaning Services in{" "}
                <span className="text-shalean-primary">Cape Town</span>
              </h1>

              <p className="mt-5 max-w-[32rem] text-base leading-relaxed text-slate-600 sm:mt-6 sm:text-lg sm:leading-[1.65] lg:text-[1.125rem]">
                {HOMEPAGE_HERO_SUBTITLE}
              </p>

              <p className="mt-5 text-sm font-medium tracking-wide text-slate-500 sm:mt-6">
                4.9★ rated · vetted cleaners · same-day availability
              </p>

              <div className="mt-8 flex flex-wrap gap-3 sm:mt-10 sm:gap-4">
                <MarketingButton
                  href={BOOKING_PATH}
                  className="!h-[3.25rem] !min-w-[11rem] !rounded-2xl !px-8 !text-[0.9375rem] !font-semibold !shadow-[0_4px_14px_rgba(37,99,235,0.28)] hover:!shadow-[0_6px_20px_rgba(37,99,235,0.32)]"
                  aria-label="Book cleaning services in Cape Town online"
                >
                  <IconCalendar className="h-5 w-5" />
                  Book Cleaning
                </MarketingButton>
                <MarketingButton
                  href={whatsappUrl}
                  variant="secondary"
                  external
                  aria-label="Chat with Shalean Cleaning Services on WhatsApp"
                  className="!h-[3.25rem] !min-w-[11rem] !rounded-2xl !border !border-slate-200/90 !bg-white !px-8 !text-[0.9375rem] !font-semibold !text-shalean-navy !shadow-sm hover:!border-slate-300"
                >
                  <IconWhatsApp className="h-5 w-5 text-[#25D366]" />
                  WhatsApp
                </MarketingButton>
              </div>
            </div>

            <div className="relative flex w-full flex-col lg:justify-self-end">
              <HeroBookingCard />
            </div>
          </div>
        </MarketingContainer>
      </div>
    </section>
  );
}
