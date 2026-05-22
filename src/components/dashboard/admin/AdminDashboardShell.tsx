"use client";

import { useState, type ReactNode } from "react";
import {
  AdminOperationsSidebar,
  AdminOperationsSidebarToggle,
} from "@/components/dashboard/admin/AdminOperationsSidebar";
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
    <div className="mx-auto flex min-w-0 max-w-[90rem]">
      <div
        className="hidden w-[17rem] shrink-0 px-3 py-4 lg:block"
        aria-hidden
      >
        <div className="h-[calc(100vh-2rem)] rounded-2xl border border-slate-200/80 bg-white" />
      </div>
    </div>
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
    <section className="min-h-screen overflow-x-clip bg-slate-50/80">
      {!mounted ? <AdminDashboardChromePlaceholder /> : null}

      <div className="mx-auto flex min-w-0 max-w-[90rem]">
        {mounted ? (
          <AdminOperationsSidebar
            mobileOpen={sidebarOpen}
            onMobileOpenChange={setSidebarOpen}
            chromeMounted={mounted}
          />
        ) : (
          <div className="hidden w-[17rem] shrink-0 px-3 py-4 lg:block" aria-hidden />
        )}

        <main className="min-w-0 flex-1 px-3 py-5 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
          {mounted ? (
            <div className="mb-3 flex items-center lg:hidden">
              <AdminOperationsSidebarToggle
                open={sidebarOpen}
                onToggle={() => setSidebarOpen(!sidebarOpen)}
              />
            </div>
          ) : null}
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
