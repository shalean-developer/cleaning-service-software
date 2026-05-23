"use client";

import Link from "next/link";
import { Wand2 } from "lucide-react";
import { AdminAccountBlock } from "@/components/dashboard/admin/AdminAccountBlock";
import { AdminNavItem } from "@/components/dashboard/admin/AdminNavItem";
import { AdminBrandIcon } from "@/components/dashboard/admin/adminNavIcons";
import {
  ADMIN_DASHBOARD_HOME,
  ADMIN_DASHBOARD_NAV_GROUPS,
  ADMIN_SIDEBAR_UTILITY_LINKS,
} from "@/features/dashboards/adminNav";

const SIDEBAR_GROUP_LABEL_CLASS =
  "px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 first:pt-2";

const SIDEBAR_UTILITY_LINK_CLASS =
  "inline-flex min-h-8 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

type Props = {
  pathname: string | null;
  onNavigate?: () => void;
};

export function AdminSidebar({ pathname, onNavigate }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-3 pb-4 pt-1">
        <Link
          href="/admin"
          onClick={onNavigate}
          className="group flex items-center gap-2.5 rounded-xl px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <AdminBrandIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-semibold text-slate-900">Shalean</span>
            <span className="block font-serif text-sm font-medium text-slate-700">Ops console</span>
          </span>
        </Link>
        <p className="mt-2 px-2 text-[11px] text-slate-500">Operational control</p>
      </div>

      <nav aria-label="Admin operations" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2">
        <div className="px-1 pb-2">
          <AdminNavItem
            {...ADMIN_DASHBOARD_HOME}
            pathname={pathname}
            layout="menu"
            onNavigate={onNavigate}
          />
        </div>

        {ADMIN_DASHBOARD_NAV_GROUPS.map((group) => (
          <div key={group.id}>
            <p className={SIDEBAR_GROUP_LABEL_CLASS}>{group.label}</p>
            <ul className="flex flex-col gap-0.5 px-1">
              {group.items.map((item) => (
                <li key={`${group.id}-${item.href}-${item.label}`}>
                  <AdminNavItem
                    {...item}
                    pathname={pathname}
                    layout="menu"
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <footer className="mt-auto border-t border-slate-200/80 px-3 py-3">
        <div className="mb-2 flex justify-end">
          <AdminAccountBlock />
        </div>

        <section aria-label="Tools" className="px-1 pb-2">
          <p className={SIDEBAR_GROUP_LABEL_CLASS}>Tools</p>
          <ul className="flex flex-col gap-0.5">
            {ADMIN_SIDEBAR_UTILITY_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={SIDEBAR_UTILITY_LINK_CLASS}
                  data-testid="admin-sidebar-customer-booking-flow"
                  title={item.description}
                >
                  <Wand2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <Link
          href="/"
          onClick={onNavigate}
          className="block px-2 text-center text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:rounded"
        >
          Hub
        </Link>
      </footer>
    </div>
  );
}
