"use client";

import type { ReactNode } from "react";
import { AdminDashboardHeader } from "@/components/dashboard/admin/AdminDashboardHeader";
import type { NavItem } from "@/components/dashboard/DashboardShell";

type Props = {
  title?: string;
  subtitle?: string;
  nav: NavItem[];
  children: ReactNode;
};

export function AdminDashboardShell({ title, subtitle, nav, children }: Props) {
  const showTitleBlock = Boolean(title?.trim() || subtitle?.trim());

  return (
    <section className="min-h-screen overflow-x-clip bg-zinc-50">
      <AdminDashboardHeader nav={nav} />
      <main className="mx-auto min-w-0 max-w-5xl px-4 py-6 sm:py-8">
        {showTitleBlock ? (
          <header className="mb-6 min-w-0">
            {title?.trim() ? (
              <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">{title}</h1>
            ) : null}
            {subtitle?.trim() ? (
              <p className="mt-1 text-sm text-zinc-600">{subtitle}</p>
            ) : null}
          </header>
        ) : null}
        {children}
      </main>
    </section>
  );
}
