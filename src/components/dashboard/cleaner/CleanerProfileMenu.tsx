"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { CLEANER_NAV_ITEMS } from "@/features/dashboards/cleanerNav";
import { resolveProfileInitials } from "@/lib/auth/profileAvatarDisplay";

export type CleanerProfileMenuProps = {
  fullName: string | null;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
};

const menuLinkClass =
  "inline-flex min-h-10 w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2";

function isNavItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/cleaner") return pathname === "/cleaner";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
      />
    </svg>
  );
}

export function CleanerProfileMenu({ fullName, email, phone, avatarUrl }: CleanerProfileMenuProps) {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const contactLine = email.trim() || phone?.trim() || "";
  const initials = resolveProfileInitials(fullName, email || phone || "");
  const hasName = Boolean(fullName?.trim());
  const displayName = fullName?.trim() || contactLine.split("@")[0] || "Account";

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${displayName} account menu`}
        onClick={() => setOpen((value) => !value)}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- OAuth avatar URLs are external and dynamic
          <img
            src={avatarUrl}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-1 ring-zinc-200/90 sm:h-10 sm:w-10"
          />
        ) : hasName ? (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/90 sm:h-10 sm:w-10"
            aria-hidden
          >
            {initials}
          </span>
        ) : initials !== "?" ? (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/90 sm:h-10 sm:w-10"
            aria-hidden
          >
            {initials}
          </span>
        ) : (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200/90 sm:h-10 sm:w-10"
            aria-hidden
          >
            <UserIcon className="h-5 w-5" />
          </span>
        )}
      </button>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40"
          aria-label="Close account menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <nav
        id={menuId}
        className={`absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 origin-top-right rounded-xl border border-zinc-200/90 bg-white py-1.5 shadow-lg transition-[opacity,transform] duration-150 ${
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
        aria-label="Account menu"
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <div className="border-b border-zinc-100 px-3 py-2">
          <p className="truncate text-sm font-semibold text-zinc-900">{displayName}</p>
          {contactLine ? <p className="truncate text-xs text-zinc-500">{contactLine}</p> : null}
        </div>
        <ul className="px-1.5 py-1">
          {CLEANER_NAV_ITEMS.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    active
                      ? `${menuLinkClass} bg-zinc-100 font-semibold text-zinc-900`
                      : menuLinkClass
                  }
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="mt-0.5 border-t border-zinc-100 pt-0.5">
            <SignOutButton className={`${menuLinkClass} justify-start`} />
          </li>
        </ul>
      </nav>
    </div>
  );
}
