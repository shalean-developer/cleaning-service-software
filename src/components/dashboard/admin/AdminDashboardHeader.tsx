"use client";

import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/dashboard/DashboardShell";
import { AdminAccountBlock } from "@/components/dashboard/admin/AdminAccountBlock";
import { AdminBrandBlock } from "@/components/dashboard/admin/AdminBrandBlock";
import { AdminNavItem } from "@/components/dashboard/admin/AdminNavItem";

type Props = {
  nav: NavItem[];
};

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function AdminDashboardHeader({ nav }: Props) {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="border-b border-zinc-200/80 bg-zinc-50 px-3 pt-3 pb-0 sm:px-4">
      <header className="mx-auto max-w-[90rem] rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex h-[3.75rem] items-stretch sm:h-14">
          <section className="flex shrink-0 items-center border-r border-zinc-200 px-3 sm:px-4">
            <AdminBrandBlock />
          </section>

          <nav
            className="hidden min-w-0 flex-1 items-center overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex [&::-webkit-scrollbar]:hidden"
            aria-label="Admin dashboard"
          >
            <div className="mx-auto flex min-w-max items-end justify-center gap-0.5 py-1">
              {nav.map((item) => (
                <AdminNavItem key={item.href} {...item} pathname={pathname} />
              ))}
            </div>
          </nav>

          <section className="flex shrink-0 items-center gap-1 border-l border-zinc-200 px-2 sm:gap-0 sm:px-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:hidden"
              aria-expanded={open}
              aria-controls={menuId}
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
            <AdminAccountBlock />
          </section>
        </div>

        {open ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-zinc-900/20 sm:hidden"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
          />
        ) : null}

        <nav
          id={menuId}
          className={`border-t border-zinc-100 px-3 py-2 transition-[opacity,max-height] duration-200 sm:hidden ${
            open ? "max-h-96 opacity-100" : "pointer-events-none max-h-0 overflow-hidden opacity-0"
          }`}
          aria-label="Admin dashboard menu"
          aria-hidden={!open}
          inert={!open ? true : undefined}
        >
          <ul className="flex flex-col gap-0.5">
            {nav.map((item) => (
              <li key={item.href}>
                <AdminNavItem
                  {...item}
                  pathname={pathname}
                  layout="menu"
                  onNavigate={() => setOpen(false)}
                />
              </li>
            ))}
          </ul>
        </nav>
      </header>
    </div>
  );
}
