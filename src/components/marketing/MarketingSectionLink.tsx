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
 * In-page section navigation without hash URLs (homepage CTAs only).
 * On the homepage, scrolls to a section; elsewhere, links to the canonical route.
 * Main header/footer nav uses href-only links — not this component.
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
  const fallbackHref = marketingSectionRoute(sectionId);

  if (!isHome) {
    return (
      <Link href={fallbackHref} className={className} onClick={onNavigate} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (scrollToSection(sectionId)) {
      onNavigate?.();
      return;
    }
    onNavigate?.();
  };

  return (
    <button type="button" className={className} onClick={handleClick} aria-label={ariaLabel}>
      {children}
    </button>
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
