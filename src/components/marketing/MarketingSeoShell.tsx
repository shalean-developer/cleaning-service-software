import type { ReactNode } from "react";
import { MarketingFooter } from "./sections/MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { MarketingSkipLink } from "./MarketingSkipLink";

type MarketingSeoShellProps = {
  children: ReactNode;
};

/** Shared chrome for marketing SEO landing pages (not the homepage). */
export function MarketingSeoShell({ children }: MarketingSeoShellProps) {
  return (
    <>
      <MarketingSkipLink />
      <MarketingHeader />
      <main
        id="main-content"
        className="bg-shalean-surface pb-24 pt-[var(--marketing-header-height)] lg:pb-16"
        tabIndex={-1}
      >
        {children}
      </main>
      <MarketingFooter />
    </>
  );
}
