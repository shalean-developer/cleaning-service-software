"use client";

import { useState, type ReactNode } from "react";
import { AdminDashboardHeader } from "@/components/dashboard/admin/AdminDashboardHeader";
import { AdminOperationsSidebar } from "@/components/dashboard/admin/AdminOperationsSidebar";
import { useClientMounted } from "@/lib/react/useClientMounted";
import type { NavItem } from "@/components/dashboard/DashboardShell";

type Props = {
  title?: string;
  subtitle?: string;
  /** Retained for compatibility; navigation lives in the operations sidebar. */
  nav: NavItem[];
  children: ReactNode;
  /** Test-only: render full chrome without waiting for client mount. */
  testChromeMounted?: boolean;
};

function AdminDashboardChromePlaceholder() {
  return (
    <>
      <div
        className="sticky top-0 z-50 border-b border-zinc-200/80 bg-zinc-50/95 backdrop-blur-md supports-[backdrop-filter]:bg-zinc-50/85"
        aria-hidden
      >
        <div className="flex min-h-[3.75rem] items-center gap-2 px-3 sm:px-4">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-zinc-100 lg:hidden" />
          <div className="h-9 min-w-0 flex-1 rounded-lg bg-zinc-100" />
          <div className="h-9 w-9 shrink-0 rounded-full bg-zinc-100" />
        </div>
      </div>
      <div className="mx-auto flex min-w-0 max-w-[90rem]">
        <div
          className="hidden w-[15.5rem] shrink-0 border-r border-zinc-200/80 bg-white lg:block"
          aria-hidden
        />
      </div>
    </>
  );
}

export function AdminDashboardShell({
  title,
  subtitle,
  nav: _nav,
  children,
  testChromeMounted,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const clientMounted = useClientMounted();
  const mounted = testChromeMounted ?? clientMounted;
  const showTitleBlock = Boolean(title?.trim() || subtitle?.trim());

  return (
    <section className="min-h-screen overflow-x-clip bg-zinc-50">
      {mounted ? (
        <AdminDashboardHeader
          sidebarOpen={sidebarOpen}
          onSidebarOpenChange={setSidebarOpen}
        />
      ) : (
        <AdminDashboardChromePlaceholder />
      )}

      <div className="mx-auto flex min-w-0 max-w-[90rem]">
        {mounted ? (
          <AdminOperationsSidebar
            mobileOpen={sidebarOpen}
            onMobileOpenChange={setSidebarOpen}
            chromeMounted={mounted}
          />
        ) : (
          <div
            className="hidden w-[15.5rem] shrink-0 border-r border-zinc-200/80 bg-white lg:block"
            aria-hidden
          />
        )}

        <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
          {showTitleBlock ? (
            <header className="mb-4 min-w-0">
              {title?.trim() ? (
                <h1 className="text-base font-semibold text-zinc-900 sm:text-lg">{title}</h1>
              ) : null}
              {subtitle?.trim() ? (
                <p className="mt-0.5 text-sm text-zinc-600">{subtitle}</p>
              ) : null}
            </header>
          ) : null}
          {children}
        </main>
      </div>
    </section>
  );
}
