"use client";

import Link from "next/link";
import { AdminNavIcon } from "@/components/dashboard/admin/adminNavIcons";
import { isAdminNavItemActive } from "@/components/dashboard/admin/adminNavActive";
import type { NavItem } from "@/components/dashboard/DashboardShell";

type Props = NavItem & {
  pathname: string | null;
  onNavigate?: () => void;
  layout?: "bar" | "menu";
};

export function AdminNavItem({ href, label, pathname, onNavigate, layout = "bar" }: Props) {
  const active = isAdminNavItemActive(pathname, href);

  if (layout === "menu") {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
          active ? "bg-blue-50 text-blue-600" : "text-zinc-600 hover:bg-zinc-100"
        }`}
      >
        <AdminNavIcon href={href} className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`group relative flex min-w-[4.75rem] max-w-[7.25rem] shrink-0 flex-col items-center gap-1 px-1.5 py-1.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        active ? "text-blue-600" : "text-zinc-500 hover:text-zinc-700"
      }`}
    >
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <AdminNavIcon href={href} className="h-[18px] w-[18px]" />
      </span>
      <span className="w-full truncate text-[11px] font-medium leading-tight">
        {label}
      </span>
      <span
        aria-hidden
        className={`absolute inset-x-1 bottom-0 h-0.5 rounded-full transition-colors ${
          active ? "bg-blue-600" : "bg-transparent group-hover:bg-zinc-200"
        }`}
      />
    </Link>
  );
}
