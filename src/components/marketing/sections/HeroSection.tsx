import Image from "next/image";
import {
  BOOKING_PATH,
  HERO_TRUST_ITEMS,
  MARKETING_IMAGES,
  SHALEAN_CONTACT,
  STATS,
} from "@/features/marketing/constants";
import { HeroBookingCard } from "../HeroBookingCard";
import {
  IconCalendar,
  IconClock,
  IconHome,
  IconLeaf,
  IconShield,
  IconSparkle,
  IconStar,
  IconUsers,
  IconWhatsApp,
} from "../icons";
import { MarketingButton } from "../MarketingButton";
import { MarketingContainer } from "../MarketingContainer";

const trustIcons = {
  shield: IconShield,
  clock: IconClock,
  leaf: IconLeaf,
  sparkle: IconSparkle,
} as const;

const statIcons = {
  home: IconHome,
  users: IconUsers,
  star: IconStar,
} as const;

export function HeroSection() {
  const whatsappUrl = `https://wa.me/${SHALEAN_CONTACT.whatsappNumber}?text=${encodeURIComponent("Hi Shalean, I'd like to book a cleaning.")}`;

  return (
    <section className="relative overflow-hidden" aria-label="Hero">
      <div className="absolute inset-0">
        <Image
          src={MARKETING_IMAGES.hero}
          alt={MARKETING_IMAGES.heroAlt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_30%] lg:object-[72%_center]"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#fff_0%,#fff_40%,rgba(255,255,255,0.85)_48%,transparent_58%)] lg:bg-[linear-gradient(to_right,#fff_0%,#fff_44%,rgba(255,255,255,0.7)_52%,transparent_62%)]"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 z-[1] h-[46%] min-h-[12rem] max-h-[20rem] bg-gradient-to-t from-white from-0% via-white/95 via-[25%] to-transparent to-[72%] sm:h-[42%] sm:max-h-[22rem] lg:h-[36%] lg:min-h-[10rem] lg:max-h-[17rem] lg:to-[68%]"
          aria-hidden
        />
      </div>

      <div className="relative z-10 pt-[4.25rem] lg:pt-[4.75rem]">
        <MarketingContainer className="pb-10 pt-4 lg:pb-12 lg:pt-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:gap-x-8 lg:gap-y-5 lg:items-stretch xl:grid-cols-[minmax(0,1fr)_minmax(0,36rem)] xl:gap-x-12">
            <div className="max-w-[36rem] lg:col-start-1 lg:row-start-1 lg:self-start">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-shalean-sky">
                Cape Town&apos;s Trusted Cleaning Professionals
              </p>

              <h1 className="mt-4 text-[2.125rem] font-bold leading-[1.08] tracking-tight text-shalean-navy sm:text-[2.75rem] lg:text-[3.25rem] xl:text-[3.5rem]">
                <span className="block whitespace-nowrap">Trusted Home Cleaning</span>
                <span className="block whitespace-nowrap">
                  in <span className="text-shalean-primary">Cape Town</span>
                </span>
              </h1>
            </div>

            <div className="flex max-w-[36rem] flex-col lg:col-start-1 lg:row-start-2 lg:h-full lg:min-h-0">
              <p className="max-w-[30rem] text-base leading-7 text-slate-600 lg:text-lg lg:leading-8">
                Reliable, vetted and insured cleaners. Book online in under 2 minutes and enjoy a
                spotless home.
              </p>

              <div className="mt-5 flex min-h-0 flex-1 flex-col gap-4 lg:mt-4">
                <ul className="flex flex-wrap items-start gap-x-4 gap-y-3 sm:gap-x-5 lg:flex-nowrap lg:gap-x-4 xl:gap-x-5">
                {HERO_TRUST_ITEMS.map((item) => {
                  const Icon = trustIcons[item.icon];
                  return (
                    <li
                      key={item.id}
                      className="flex w-[calc(50%-0.5rem)] items-center gap-2 text-left sm:w-auto sm:max-w-none"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-shalean-soft-blue text-shalean-primary sm:h-8 sm:w-8">
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </span>
                      <span className="text-[10px] font-semibold leading-snug text-slate-600 sm:text-[11px]">
                        {item.label}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap gap-3 sm:gap-4">
                <MarketingButton
                  href={BOOKING_PATH}
                  className="!h-[3.25rem] !min-w-[10.5rem] !rounded-xl !px-7 !text-base"
                >
                  <IconCalendar className="h-5 w-5" />
                  Book Now
                </MarketingButton>
                <MarketingButton
                  href={whatsappUrl}
                  variant="secondary"
                  external
                  className="!h-[3.25rem] !min-w-[10.75rem] !rounded-xl !border-2 !border-shalean-primary !bg-white !px-7 !text-base !text-shalean-primary hover:!bg-blue-50"
                >
                  <IconWhatsApp className="h-5 w-5" />
                  WhatsApp Us
                </MarketingButton>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <IconStar key={i} className="h-5 w-5" />
                  ))}
                </div>
                <p className="text-sm font-semibold text-shalean-navy">
                  4.9/5 from 1,200+ Google reviews
                </p>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-blue-600 shadow-sm ring-1 ring-shalean-border"
                  aria-label="Google"
                >
                  G
                </span>
              </div>

              <div className="relative isolate lg:mt-auto">
                <div
                  className="pointer-events-none absolute top-0 left-1/2 z-0 w-screen -translate-x-1/2 bg-gradient-to-t from-white from-0% via-white/90 via-[30%] to-transparent to-100% [height:calc(100%+2.5rem)] lg:[height:calc(100%+3rem)]"
                  aria-hidden
                />
                <ul
                  className="relative z-[1] grid max-w-[26rem] grid-cols-3 gap-x-2 rounded-xl border border-shalean-border/80 bg-slate-100/95 px-3 py-3 shadow-sm ring-1 ring-blue-100/60 backdrop-blur-sm sm:max-w-[30rem] sm:gap-x-3 sm:px-3.5 sm:py-3.5"
                  aria-label="Company statistics"
                >
                {STATS.map((stat, index) => {
                  const Icon = statIcons[stat.icon];
                  return (
                    <li
                      key={stat.label}
                      className={`flex min-w-0 items-center gap-1.5 sm:gap-2 ${
                        index > 0 ? "border-l border-slate-300/80 pl-2 sm:pl-3" : ""
                      }`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-shalean-soft-blue/90 text-shalean-primary sm:h-7 sm:w-7">
                        <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </span>
                      <p className="text-[10px] leading-tight sm:text-[11px]">
                        <span className="block font-bold text-shalean-primary">{stat.value}</span>
                        <span className="text-slate-500">{stat.label}</span>
                      </p>
                    </li>
                  );
                })}
                </ul>
              </div>
              </div>
            </div>

            <div className="flex w-full flex-col items-start lg:col-start-2 lg:row-start-2 lg:h-full">
              <HeroBookingCard />
            </div>
          </div>
        </MarketingContainer>
      </div>
    </section>
  );
}
