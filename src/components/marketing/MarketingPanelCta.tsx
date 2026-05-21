import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowRight } from "./icons";

type MarketingPanelCtaProps = {
  href: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

export function MarketingPanelCta({
  href,
  children,
  className = "",
  "aria-label": ariaLabel,
}: MarketingPanelCtaProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`marketing-focus-ring group/cta inline-flex min-h-11 items-center gap-2 rounded-full bg-shalean-primary px-6 text-sm font-semibold text-white transition duration-200 hover:bg-blue-600 ${className}`.trim()}
    >
      {children}
      <IconArrowRight
        className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
