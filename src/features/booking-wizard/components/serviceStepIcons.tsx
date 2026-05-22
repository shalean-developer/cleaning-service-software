import type { ReactElement } from "react";
import type { ServiceSlug } from "@/features/pricing/server/types";

type IconProps = { className?: string };

function IconHome({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSparkles({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.2 4.2L17.5 8.5 13.2 9.7 12 14l-1.2-4.3L6.5 8.5l4.3-1.3L12 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M5 16l.7 2.3L8 19l-2.3.7L5 22l-.7-2.3L2 19l2.3-.7L5 16ZM19 14l.5 1.8 1.7.5-1.7.5-.5 1.7-.5-1.7-1.7-.5 1.7-.5.5-1.8Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBox({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M12 12 20 7.5M12 12v9M12 12 4 7.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconKey({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="15" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M11.5 12 21 7v4l-3 1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBuilding({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 21V5a1 1 0 0 1 1-1h5v17M11 8h2M11 12h2M11 16h2M14 4h5a1 1 0 0 1 1 1v16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path d="M5 21h14" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconRug({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 9c0-2.2 3.1-4 7-4s7 1.8 7 4v6c0 2.2-3.1 4-7 4s-7-1.8-7-4V9Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M5 12h14" stroke="currentColor" strokeWidth="1.75" strokeDasharray="2 2" />
    </svg>
  );
}

const SERVICE_ICONS: Record<ServiceSlug, (props: IconProps) => ReactElement> = {
  "regular-cleaning": IconHome,
  "deep-cleaning": IconSparkles,
  "moving-cleaning": IconBox,
  "airbnb-cleaning": IconKey,
  "office-cleaning": IconBuilding,
  "carpet-cleaning": IconRug,
};

const SERVICE_ICON_COLORS: Record<ServiceSlug, string> = {
  "regular-cleaning": "text-sky-600",
  "deep-cleaning": "text-violet-600",
  "moving-cleaning": "text-amber-600",
  "airbnb-cleaning": "text-rose-600",
  "office-cleaning": "text-slate-700",
  "carpet-cleaning": "text-teal-600",
};

const SERVICE_ICON_SURFACES: Record<ServiceSlug, string> = {
  "regular-cleaning": "bg-sky-50",
  "deep-cleaning": "bg-violet-50",
  "moving-cleaning": "bg-amber-50",
  "airbnb-cleaning": "bg-rose-50",
  "office-cleaning": "bg-slate-100",
  "carpet-cleaning": "bg-teal-50",
};

export function ServiceStepIcon({
  slug,
  className,
}: {
  slug: ServiceSlug;
  className?: string;
}) {
  const Icon = SERVICE_ICONS[slug];
  return <Icon className={className} />;
}

export function serviceIconColorClass(slug: ServiceSlug): string {
  return SERVICE_ICON_COLORS[slug];
}

export function serviceIconSurfaceClass(slug: ServiceSlug): string {
  return SERVICE_ICON_SURFACES[slug];
}
