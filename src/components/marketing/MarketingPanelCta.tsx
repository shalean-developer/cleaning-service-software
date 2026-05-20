import Link from "next/link";
import type { ReactNode } from "react";
import { IconArrowRight } from "./icons";

type MarketingPanelCtaProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function MarketingPanelCta({ href, children, className = "" }: MarketingPanelCtaProps) {
  return (
    <Link
      href={href}
      className={`marketing-focus-ring group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-shalean-primary px-6 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(37,99,235,0.2)] transition-[background-color,box-shadow,transform] duration-200 hover:bg-blue-600 hover:shadow-[0_4px_18px_rgba(37,99,235,0.28)] ${className}`.trim()}
    >
      {children}
      <IconArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  );
}
