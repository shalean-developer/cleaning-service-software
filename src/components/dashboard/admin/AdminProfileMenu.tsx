"use client";

import { useEffect, useId, useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { resolveProfileInitials } from "@/lib/auth/profileAvatarDisplay";

export type AdminProfileMenuProps = {
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

const menuActionClass =
  "inline-flex min-h-10 w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2";

export function AdminProfileMenu({
  fullName = null,
  email = null,
  avatarUrl = null,
}: AdminProfileMenuProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const trimmedEmail = email?.trim() ?? "";
  const displayName = fullName?.trim() || "Admin";
  const initials = resolveProfileInitials(fullName, trimmedEmail || "admin");

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
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
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
            className="h-8 w-8 rounded-full object-cover ring-1 ring-zinc-200/90 sm:h-9 sm:w-9"
          />
        ) : (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 ring-1 ring-blue-200/80 sm:h-9 sm:w-9"
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
        aria-label="Admin account menu"
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <div className="border-b border-zinc-100 px-3 py-2">
          <p className="truncate text-sm font-semibold text-zinc-900">{displayName}</p>
          <p className="truncate text-xs text-zinc-500">Administrator</p>
          {trimmedEmail ? (
            <p className="mt-0.5 truncate text-xs text-zinc-500">{trimmedEmail}</p>
          ) : null}
        </div>
        <div className="px-1.5 pt-1">
          <SignOutButton
            className={`${menuActionClass} justify-start`}
            onBeforeSignOut={() => setOpen(false)}
          />
        </div>
      </nav>
    </div>
  );
}
