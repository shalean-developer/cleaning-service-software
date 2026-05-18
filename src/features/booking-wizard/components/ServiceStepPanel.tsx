import type { ReactNode } from "react";
import type { ServiceSlug } from "@/features/pricing/server/types";
import {
  SERVICE_STEP_DESCRIPTIONS_DESKTOP,
  type WizardServiceOption,
} from "../constants";
import {
  ServiceStepIcon,
  serviceIconColorClass,
  serviceIconSurfaceClass,
} from "./serviceStepIcons";

type Props = {
  options: WizardServiceOption[];
  selectedSlug: ServiceSlug | null;
  onSelect: (slug: ServiceSlug) => void;
  error?: string;
};

type ServiceCardProps = {
  service: WizardServiceOption;
  selected: boolean;
  onSelect: (slug: ServiceSlug) => void;
};

const MOST_BOOKED_SLUG: ServiceSlug = "regular-cleaning";

function MostBookedPill({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-sky-200/80 bg-sky-100 px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-sky-800 shadow-sm ${className}`}
    >
      Most booked
    </span>
  );
}

function CardTopBadge({ children }: { children: ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-3 top-0 z-10 -translate-y-1/2 md:left-4">
      {children}
    </span>
  );
}

function SelectedBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  const box = size === "md" ? "h-6 w-6" : "h-5 w-5";
  const icon = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";

  return (
    <span
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white`}
      aria-hidden
    >
      <svg viewBox="0 0 12 12" className={icon} fill="none">
        <path
          d="M2.5 6l2.5 2.5 4.5-5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Mobile layout — structure frozen; approved RC-1B copy/clamp/spacing tweaks only. */
function ServiceCardMobile({ service, selected, onSelect }: ServiceCardProps) {
  const showMostBooked = service.slug === MOST_BOOKED_SLUG;

  return (
    <button
      type="button"
      onClick={() => onSelect(service.slug)}
      aria-pressed={selected}
      className={`relative flex w-full min-w-0 items-center gap-3 rounded-lg border px-3 py-3 pr-10 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 active:scale-[0.99] ${
        selected
          ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900/10"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50"
      }`}
    >
      {showMostBooked ? (
        <CardTopBadge>
          <MostBookedPill />
        </CardTopBadge>
      ) : null}

      {selected ? (
        <span className="absolute right-2.5 top-2.5">
          <SelectedBadge />
        </span>
      ) : null}

      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${serviceIconSurfaceClass(service.slug)} ${serviceIconColorClass(service.slug)}`}
      >
        <ServiceStepIcon slug={service.slug} className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[0.8125rem] font-semibold leading-snug text-zinc-900">
          {service.label}
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-zinc-500 [text-wrap:pretty] line-clamp-2">
          {service.description}
        </span>
      </span>
    </button>
  );
}

/** Desktop-only compact card — icon + title row, full-width description below. */
function ServiceCardDesktop({ service, selected, onSelect }: ServiceCardProps) {
  const showMostBooked = service.slug === MOST_BOOKED_SLUG;

  return (
    <button
      type="button"
      onClick={() => onSelect(service.slug)}
      aria-pressed={selected}
      className={`group relative flex w-full min-w-0 flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition-[border-color,box-shadow,background-color] duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 motion-reduce:transition-none ${
        selected
          ? "border-zinc-900 bg-zinc-50 shadow-[0_1px_2px_rgba(24,24,27,0.06),0_4px_14px_rgba(24,24,27,0.08)]"
          : "border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)] hover:border-zinc-300 hover:bg-zinc-50/40 hover:shadow-[0_2px_10px_rgba(24,24,27,0.07)]"
      }`}
    >
      {showMostBooked ? (
        <CardTopBadge>
          <MostBookedPill />
        </CardTopBadge>
      ) : null}

      <span className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset transition-colors ${
            selected ? "ring-zinc-900/10" : "ring-zinc-900/[0.06]"
          } ${serviceIconSurfaceClass(service.slug)} ${serviceIconColorClass(service.slug)}`}
        >
          <ServiceStepIcon slug={service.slug} className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1 pt-0.5 text-[0.9375rem] font-semibold tracking-tight leading-snug text-zinc-900">
          {service.label}
        </span>
        {selected ? (
          <span className="shrink-0 rounded-full shadow-sm ring-2 ring-white">
            <SelectedBadge size="md" />
          </span>
        ) : null}
      </span>

      <p className="m-0 block min-h-[2.625rem] w-full min-w-0 flex-none text-[0.8125rem] leading-relaxed text-zinc-600 [text-wrap:pretty] line-clamp-2">
        {SERVICE_STEP_DESCRIPTIONS_DESKTOP[service.slug]}
      </p>
    </button>
  );
}

function ServiceCard(props: ServiceCardProps) {
  const reserveBadgeSpace = props.service.slug === MOST_BOOKED_SLUG;

  return (
    <li className={`w-full min-w-0 ${reserveBadgeSpace ? "pt-2.5" : ""}`}>
      <div className="md:hidden">
        <ServiceCardMobile {...props} />
      </div>
      <div className="hidden w-full min-w-0 md:block">
        <ServiceCardDesktop {...props} />
      </div>
    </li>
  );
}

export function ServiceStepPanel({ options, selectedSlug, onSelect, error }: Props) {
  const enabled = options.filter((s) => s.enabled);

  return (
    <div>
      <header className="mb-4 md:mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Choose a service</h2>
        <p className="mt-1 hidden text-sm leading-relaxed text-zinc-500 md:block">
          Select the type of clean you need. You can change this later before checkout.
        </p>
      </header>

      <ul
        className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4 md:[&>li]:min-w-0 xl:grid-cols-3 xl:gap-5"
        role="list"
      >
        {enabled.map((service) => (
          <ServiceCard
            key={service.slug}
            service={service}
            selected={selectedSlug === service.slug}
            onSelect={onSelect}
          />
        ))}
      </ul>

      {error ? (
        <p className="mt-2.5 text-sm text-red-600 md:mt-4" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
