"use client";

import Link from "next/link";
import { AdminBrandIcon } from "@/components/dashboard/admin/adminNavIcons";

export function AdminBrandBlock() {
  return (
    <Link
      href="/admin"
      className="group flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <AdminBrandIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-semibold text-zinc-900">Cleaning Service</span>
        <span className="block truncate text-xs font-medium text-blue-600">Admin Dashboard</span>
      </span>
    </Link>
  );
}
