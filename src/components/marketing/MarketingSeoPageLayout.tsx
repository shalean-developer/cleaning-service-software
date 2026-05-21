import type { ReactNode } from "react";
import { MarketingContainer } from "./MarketingContainer";
import {
  MarketingBreadcrumbs,
  type BreadcrumbItem,
} from "./MarketingBreadcrumbs";

type MarketingSeoPageLayoutProps = {
  breadcrumbs: BreadcrumbItem[];
  h1: string;
  intro: string;
  children?: ReactNode;
  afterIntro?: ReactNode;
};

export function MarketingSeoPageLayout({
  breadcrumbs,
  h1,
  intro,
  children,
  afterIntro,
}: MarketingSeoPageLayoutProps) {
  return (
    <MarketingContainer className="py-10 sm:py-14 lg:py-16">
      <MarketingBreadcrumbs items={breadcrumbs} />
      <header className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-shalean-navy sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]">
          {h1}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
          {intro}
        </p>
        {afterIntro ? <div className="mt-6">{afterIntro}</div> : null}
      </header>
      {children ? <div className="mt-12">{children}</div> : null}
    </MarketingContainer>
  );
}
