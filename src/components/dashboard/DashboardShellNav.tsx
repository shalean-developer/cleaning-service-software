"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { NavItem } from "@/components/dashboard/DashboardShell";

type Props = {
  nav: NavItem[];
};

const navLinkClass =
  "inline-flex min-h-10 w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2";

const desktopNavLinkClass =
  "inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2";

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

export function DashboardShellNav({ nav }: Props) {
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
    <>
      <nav className="hidden items-center gap-2 sm:flex sm:flex-wrap" aria-label="Dashboard">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className={desktopNavLinkClass}>
            {item.label}
          </Link>
        ))}
        <SignOutButton className={desktopNavLinkClass} />
      </nav>

      <section className="relative sm:hidden">
        <button
          type="button"
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>

        {open ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-zinc-900/20"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        ) : null}

        <nav
          id={menuId}
          className={`fixed inset-x-0 top-14 z-50 border-b border-zinc-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg transition-[opacity,transform] duration-200 ${
            open
              ? "pointer-events-auto translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-2 opacity-0"
          }`}
          aria-label="Dashboard menu"
          aria-hidden={!open}
        >
          <ul className="mx-auto flex max-w-5xl flex-col gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={navLinkClass} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <SignOutButton className={`${navLinkClass} justify-start`} />
            </li>
          </ul>
        </nav>
      </section>
    </>
  );
}
