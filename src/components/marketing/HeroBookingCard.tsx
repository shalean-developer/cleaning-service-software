"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  estimateBasePriceCents,
  formatZarFromCents,
} from "@/features/marketing/constants";
import { customerBookServicePath } from "@/features/booking-wizard/bookServiceRoute";
import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { ClientOnly } from "./ClientOnly";
import { IconArrowRight, IconCalendar, IconMapPin } from "./icons";
import { HeroBookingCardSkeleton } from "./HeroBookingCardSkeleton";

const SERVICE_OPTIONS = (
  [
    "regular-cleaning",
    "deep-cleaning",
    "moving-cleaning",
    "airbnb-cleaning",
  ] as const
).map((slug) => ({
  slug,
  label: SERVICE_CATALOG[slug].label,
}));

const LOCATIONS = [
  "Sea Point, Cape Town",
  "Claremont, Cape Town",
  "Camps Bay, Cape Town",
  "Bellville, Cape Town",
  "Durbanville, Cape Town",
  "Other Cape Town area",
];

const fieldClass =
  "h-11 w-full rounded-lg border border-shalean-border bg-white px-3 text-sm text-shalean-navy outline-none transition focus:border-shalean-primary focus:ring-2 focus:ring-shalean-primary/15";

const labelClass = "mb-1.5 block text-xs font-semibold text-slate-500";

function HeroBookingCardForm() {
  const router = useRouter();
  const [service, setService] = useState<ServiceSlug>("regular-cleaning");
  const [bedrooms, setBedrooms] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [date, setDate] = useState("");
  const minDate = useMemo(
    () => (typeof window !== "undefined" ? new Date().toISOString().slice(0, 10) : ""),
    [],
  );

  const estimatedCents = useMemo(
    () => estimateBasePriceCents(service, bedrooms, bathrooms),
    [service, bedrooms, bathrooms],
  );

  return (
    <div className="w-full rounded-2xl border border-shalean-border/80 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.12)] sm:p-7">
      <h2 className="text-xl font-bold text-shalean-navy sm:text-[1.35rem]">
        Get Your <span className="text-shalean-primary">Instant</span> Cleaning Quote
      </h2>

      <div className="mt-5 grid gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)_5.25rem_5.25rem] gap-3 sm:gap-4">
          <label className="block min-w-0">
            <span className={labelClass}>Select Service</span>
            <select
              value={service}
              onChange={(e) => setService(e.target.value as ServiceSlug)}
              className={fieldClass}
              autoComplete="off"
            >
              {SERVICE_OPTIONS.map((opt) => (
                <option key={opt.slug} value={opt.slug}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className={labelClass}>Bedrooms</span>
            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(Number(e.target.value))}
              className={fieldClass}
              autoComplete="off"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0">
            <span className={labelClass}>Bathrooms</span>
            <select
              value={bathrooms}
              onChange={(e) => setBathrooms(Number(e.target.value))}
              className={fieldClass}
              autoComplete="off"
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Select Date</span>
            <div className="relative">
              <IconCalendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                min={minDate || undefined}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`${fieldClass} pl-10`}
                autoComplete="off"
              />
            </div>
          </label>
          <label className="block">
            <span className={labelClass}>Location</span>
            <div className="relative">
              <IconMapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={`${fieldClass} pl-10`}
                autoComplete="off"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-shalean-border pt-5">
        <div>
          <p className="text-xs font-medium text-slate-500">Estimated Price</p>
          <p className="text-[2rem] font-extrabold leading-none text-shalean-primary">
            {formatZarFromCents(estimatedCents)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push(customerBookServicePath(service))}
          className="inline-flex h-12 min-w-[9.5rem] items-center justify-center gap-2 rounded-xl bg-shalean-primary px-6 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition hover:bg-blue-600"
        >
          Book Now
          <IconArrowRight className="h-4 w-4" />
        </button>
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
