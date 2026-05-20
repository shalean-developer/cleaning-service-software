import Link from "next/link";
import type { ReactNode } from "react";

type MarketingTextLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function MarketingTextLink({ href, children, className = "" }: MarketingTextLinkProps) {
  return (
    <Link
      href={href}
      className={`marketing-focus-ring inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-shalean-primary transition hover:text-blue-600 ${className}`.trim()}
    >
      {children}
      <span aria-hidden>→</span>
    </Link>
  );
}
