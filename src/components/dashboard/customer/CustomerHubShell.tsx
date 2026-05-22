"use client";

import { useState } from "react";
import { CustomerHubSidebar } from "@/components/dashboard/customer/CustomerHubSidebar";

type Props = {
  accountLabel: string;
  showLiveBadge: boolean;
  footerSlot?: React.ReactNode;
  children: React.ReactNode;
};

export function CustomerHubShell({
  accountLabel,
  showLiveBadge,
  footerSlot,
  children,
}: Props) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f7fc] lg:flex">
      <div className="hidden w-[220px] shrink-0 border-r border-zinc-200/80 bg-white lg:block xl:w-[240px]">
        <div className="sticky top-0 flex h-screen flex-col">
          <CustomerHubSidebar
            accountLabel={accountLabel}
            showLiveBadge={showLiveBadge}
            footerSlot={footerSlot}
          />
        </div>
      </div>

      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-zinc-900/40 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[min(280px,88vw)] border-r border-zinc-200/80 bg-white shadow-xl transition-transform duration-200 lg:hidden ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!mobileNavOpen}
      >
        <CustomerHubSidebar
          accountLabel={accountLabel}
          showLiveBadge={showLiveBadge}
          footerSlot={footerSlot}
          onNavigate={() => setMobileNavOpen(false)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200/70 bg-[#f4f7fc]/90 px-4 py-3 backdrop-blur-md lg:hidden">
          <button
            type="button"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700"
            aria-expanded={mobileNavOpen}
            aria-label="Open menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="font-serif text-lg font-medium text-shalean-navy">Shalean</span>
        </header>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
