"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { resolveProfileInitials } from "@/lib/auth/profileAvatarDisplay";
import { CUSTOMER_DASHBOARD_NAV } from "@/features/dashboards/customerNav";

export type CustomerProfileMenuProps = {
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
};

const menuLinkClass =
  "inline-flex min-h-10 w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-shalean-soft-blue/50 hover:text-shalean-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shalean-primary focus-visible:ring-offset-2";

function isNavItemActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/customer") return pathname === "/customer";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CustomerProfileMenu({ fullName, email, avatarUrl }: CustomerProfileMenuProps) {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const initials = resolveProfileInitials(fullName, email);
  const displayName = fullName?.trim() || email.split("@")[0] || "Account";

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
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shalean-primary focus-visible:ring-offset-2"
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
        ) : (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/90 sm:h-10 sm:w-10"
            aria-hidden
          >
            {initials}
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
        <div className="border-b border-slate-100 px-3 py-2">
          <p className="truncate text-sm font-semibold text-shalean-navy">{displayName}</p>
          <p className="truncate text-xs text-slate-500">{email}</p>
        </div>
        <ul className="px-1.5 py-1">
          {CUSTOMER_DASHBOARD_NAV.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    active
                      ? `${menuLinkClass} bg-shalean-soft-blue/50 font-semibold text-shalean-navy`
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
          <li className="mt-0.5 border-t border-slate-100 pt-0.5">
            <SignOutButton className={`${menuLinkClass} justify-start`} />
          </li>
        </ul>
      </nav>
    </div>
  );
}
