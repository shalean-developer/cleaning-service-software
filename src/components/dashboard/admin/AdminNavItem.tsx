"use client";

import Link from "next/link";
import { AdminNavIcon } from "@/components/dashboard/admin/adminNavIcons";
import { isAdminNavItemActive } from "@/components/dashboard/admin/adminNavActive";
import type { NavItem } from "@/components/dashboard/DashboardShell";

type Props = NavItem & {
  pathname: string | null;
  onNavigate?: () => void;
  layout?: "bar" | "menu";
  /** Highlights primary destinations such as Home in the bar layout. */
  emphasis?: "primary";
};

export function AdminNavItem({
  href,
  label,
  pathname,
  onNavigate,
  layout = "bar",
  emphasis,
}: Props) {
  const active = isAdminNavItemActive(pathname, href);

  if (layout === "menu") {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
          active
            ? "bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)]"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <AdminNavIcon href={href} className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
      </Link>
    );
  }

  const primaryBar = emphasis === "primary";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`group relative flex shrink-0 flex-col items-center gap-1 px-1.5 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
        primaryBar ? "min-w-[4.5rem] max-w-[5.5rem]" : "min-w-[4.25rem] max-w-[6.75rem]"
      } ${
        active
          ? primaryBar
            ? "text-blue-700"
            : "text-blue-600"
          : primaryBar
            ? "text-zinc-700 hover:text-blue-600"
            : "text-zinc-500 hover:text-zinc-700"
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
        className={`absolute inset-x-1 bottom-0 h-0.5 rounded-full transition-colors duration-150 ${
          active
            ? primaryBar
              ? "bg-blue-700"
              : "bg-blue-600"
            : "bg-transparent group-hover:bg-zinc-200"
        }`}
      />
    </Link>
  );
}
