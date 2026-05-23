"use client";

import Link from "next/link";
import { Wand2 } from "lucide-react";
import { AdminAccountBlock } from "@/components/dashboard/admin/AdminAccountBlock";
import { AdminNavItem } from "@/components/dashboard/admin/AdminNavItem";
import { AdminBrandIcon } from "@/components/dashboard/admin/adminNavIcons";
import {
  ADMIN_DASHBOARD_HOME,
  ADMIN_DASHBOARD_NAV_GROUPS,
} from "@/features/dashboards/adminNav";

const SIDEBAR_GROUP_LABEL_CLASS =
  "px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 first:pt-2";

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

      <div className="mt-auto border-t border-slate-200/80 px-3 py-4">
        <div className="mb-3 flex justify-end">
          <AdminAccountBlock />
        </div>
        <Link
          href="/customer/book"
          onClick={onNavigate}
          className="inline-flex w-full min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Wand2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Customer booking flow
        </Link>
        <Link
          href="/"
          onClick={onNavigate}
          className="mt-2 block text-center text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:rounded"
        >
          Hub
        </Link>
      </div>
    </div>
  );
}
