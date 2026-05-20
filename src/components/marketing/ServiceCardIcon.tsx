import type { JSX } from "react";
import type { ServiceSlug } from "@/features/pricing/server/types";
import {
  IconCalendar,
  IconHome,
  IconLeaf,
  IconMapPin,
  IconSparkle,
  IconUsers,
} from "./icons";

type IconComponent = ({ className }: { className?: string }) => JSX.Element;

const SERVICE_ICONS: Record<ServiceSlug, IconComponent> = {
  "regular-cleaning": IconHome,
  "deep-cleaning": IconSparkle,
  "moving-cleaning": IconMapPin,
  "airbnb-cleaning": IconCalendar,
  "office-cleaning": IconUsers,
  "carpet-cleaning": IconLeaf,
};

type ServiceCardIconProps = {
  slug: ServiceSlug;
  className?: string;
};

export function ServiceCardIcon({ slug, className = "" }: ServiceCardIconProps) {
  const Icon = SERVICE_ICONS[slug];

  return (
    <div
      className={`flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-shalean-soft-blue to-blue-50/80 sm:h-20 sm:w-20 ${className}`.trim()}
      aria-hidden
    >
      <Icon className="h-9 w-9 text-shalean-primary/90 transition-transform duration-300 ease-out group-hover:scale-105 sm:h-10 sm:w-10" />
    </div>
  );
}
