"use client";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { AdminChevronDownIcon, AdminSignOutIcon } from "@/components/dashboard/admin/adminNavIcons";

const signOutClassName =
  "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-60 sm:px-3 sm:text-sm";

export function AdminAccountBlock() {
  return (
    <section className="flex shrink-0 items-center gap-2 sm:gap-3">
      <button
        type="button"
        className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        aria-label="Admin account"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
          aria-hidden
        >
          AD
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-semibold leading-tight text-zinc-900">Admin</span>
          <span className="block truncate text-xs leading-tight text-zinc-500">Administrator</span>
        </span>
        <AdminChevronDownIcon className="hidden h-4 w-4 shrink-0 text-zinc-400 sm:block" />
      </button>

      <SignOutButton
        className={signOutClassName}
        leadingIcon={<AdminSignOutIcon className="h-4 w-4 shrink-0" />}
      />
    </section>
  );
}
