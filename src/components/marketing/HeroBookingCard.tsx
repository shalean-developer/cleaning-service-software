"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  estimateBasePriceCents,
  formatZarFromCents,
  marketingBookPath,
} from "@/features/marketing/constants";
import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { ClientOnly } from "./ClientOnly";
import { IconArrowRight, IconMapPin } from "./icons";
import { HeroBookingCardSkeleton } from "./HeroBookingCardSkeleton";
import { MarketingDatePicker } from "./MarketingDatePicker";
import { todayIsoDateLocal } from "./marketingDateUtils";
import { MarketingSelect, type MarketingSelectOption } from "./MarketingSelect";

const SERVICE_OPTIONS: readonly MarketingSelectOption[] = (
  [
    "regular-cleaning",
    "deep-cleaning",
    "moving-cleaning",
    "airbnb-cleaning",
  ] as const
).map((slug) => ({
  value: slug,
  label: SERVICE_CATALOG[slug].label,
}));

const BEDROOM_OPTIONS: readonly MarketingSelectOption[] = [1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: String(n),
}));

const BATHROOM_OPTIONS: readonly MarketingSelectOption[] = [1, 2, 3, 4].map((n) => ({
  value: String(n),
  label: String(n),
}));

const LOCATION_OPTIONS: readonly MarketingSelectOption[] = [
  "Sea Point, Cape Town",
  "Claremont, Cape Town",
  "Camps Bay, Cape Town",
  "Bellville, Cape Town",
  "Durbanville, Cape Town",
  "Other Cape Town area",
].map((loc) => ({ value: loc, label: loc }));

const labelClass = "mb-2.5 block text-sm font-medium text-slate-700";

function HeroBookingCardForm() {
  const router = useRouter();
  const [service, setService] = useState<ServiceSlug>("regular-cleaning");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [location, setLocation] = useState(LOCATION_OPTIONS[0].value);
  const minDate = useMemo(() => todayIsoDateLocal(), []);
  const [date, setDate] = useState(() => todayIsoDateLocal());

  const estimatedCents = useMemo(
    () => estimateBasePriceCents(service, bedrooms, bathrooms),
    [service, bedrooms, bathrooms],
  );

  return (
    <div className="marketing-hero-quote-card relative w-full rounded-3xl border border-white/80 bg-white p-7 sm:p-9 lg:max-w-[36rem] lg:justify-self-end xl:max-w-[38rem]">
      <p className="text-sm font-medium text-slate-500">Instant quote</p>

      <div className="mt-7 grid gap-6">
        <div className="grid grid-cols-1 gap-5 min-[420px]:grid-cols-[minmax(0,1fr)_6.25rem_6.25rem] sm:gap-6">
          <div className="block min-w-0">
            <span className={labelClass}>Service</span>
            <MarketingSelect
              value={service}
              onChange={(next) => setService(next as ServiceSlug)}
              options={SERVICE_OPTIONS}
              ariaLabel="Service"
            />
          </div>
          <div className="block min-w-0">
            <span className={labelClass}>Bedrooms</span>
            <MarketingSelect
              value={String(bedrooms)}
              onChange={(next) => setBedrooms(Number(next))}
              options={BEDROOM_OPTIONS}
              ariaLabel="Bedrooms"
            />
          </div>
          <div className="block min-w-0">
            <span className={labelClass}>Bathrooms</span>
            <MarketingSelect
              value={String(bathrooms)}
              onChange={(next) => setBathrooms(Number(next))}
              options={BATHROOM_OPTIONS}
              ariaLabel="Bathrooms"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="block">
            <span className={labelClass}>Date</span>
            <MarketingDatePicker
              value={date}
              onChange={setDate}
              minDate={minDate}
              ariaLabel="Date"
            />
          </div>
          <div className="block">
            <span className={labelClass}>Location</span>
            <MarketingSelect
              value={location}
              onChange={setLocation}
              options={LOCATION_OPTIONS}
              ariaLabel="Location"
              iconLeft={
                <IconMapPin className="h-[1.125rem] w-[1.125rem]" aria-hidden />
              }
            />
          </div>
        </div>
      </div>

      <div className="mt-9 border-t border-slate-100 pt-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500">Estimated price</p>
            <p className="mt-2 text-[2.25rem] font-extrabold leading-none tracking-[-0.02em] text-shalean-primary sm:text-[2.5rem]">
              {formatZarFromCents(estimatedCents)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(marketingBookPath(service))}
            className="marketing-focus-ring inline-flex h-14 w-full shrink-0 items-center justify-center gap-2.5 rounded-2xl bg-shalean-primary px-8 text-[0.9375rem] font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.28)] transition hover:bg-blue-600 hover:shadow-[0_6px_20px_rgba(37,99,235,0.32)] sm:w-auto sm:min-w-[11.5rem]"
          >
            Book Now
            <IconArrowRight className="h-[1.125rem] w-[1.125rem]" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function HeroBookingCard() {
  return (
    <ClientOnly fallback={<HeroBookingCardSkeleton />}>
      <HeroBookingCardForm />
    </ClientOnly>
  );
}
