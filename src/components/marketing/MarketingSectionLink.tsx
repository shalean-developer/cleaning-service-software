"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { marketingSectionRoute } from "@/lib/ui/marketingSectionRoutes";
import type { MarketingSectionId } from "@/lib/ui/scrollToSection";
import { scrollToSection } from "@/lib/ui/scrollToSection";

type MarketingSectionLinkProps = {
  sectionId: MarketingSectionId;
  children: ReactNode;
  className?: string;
  onNavigate?: () => void;
  "aria-label"?: string;
};

/**
 * Section CTAs without hash URLs. Always renders a Link (stable SSR/hydration).
 * On the homepage, click scrolls to the section when present; otherwise follows href.
 * Main header/footer nav uses href-only links. not this component.
 */
export function MarketingSectionLink({
  sectionId,
  children,
  className = "",
  onNavigate,
  "aria-label": ariaLabel,
}: MarketingSectionLinkProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const href = marketingSectionRoute(sectionId);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isHome && scrollToSection(sectionId)) {
      event.preventDefault();
      onNavigate?.();
    } else {
      onNavigate?.();
    }
  };

  return (
    <Link
      href={href}
      className={className}
      onClick={handleClick}
      aria-label={ariaLabel}
      suppressHydrationWarning
    >
      {children}
    </Link>
  );
}

type MarketingSectionOrRouteLinkProps = {
  children: ReactNode;
  className?: string;
  sectionId?: MarketingSectionId;
  href?: string;
  onNavigate?: () => void;
};

/** Header/footer nav item: route Link or hashless section scroll. */
export function MarketingSectionOrRouteLink({
  sectionId,
  href,
  children,
  className = "",
  onNavigate,
}: MarketingSectionOrRouteLinkProps) {
  if (sectionId) {
    return (
      <MarketingSectionLink
        sectionId={sectionId}
        className={className}
        onNavigate={onNavigate}
      >
        {children}
      </MarketingSectionLink>
    );
  }

  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link href={href} className={className} onClick={onNavigate}>
      {children}
    </Link>
  );
}
