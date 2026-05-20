"use client";

import { useEffect, useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminNavItem } from "@/components/dashboard/admin/AdminNavItem";
import { useClientMounted } from "@/lib/react/useClientMounted";
import {
  ADMIN_DASHBOARD_HOME,
  ADMIN_DASHBOARD_NAV_GROUPS,
  ADMIN_SIDEBAR_QUICK_ACTIONS,
} from "@/features/dashboards/adminNav";

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

const SIDEBAR_GROUP_LABEL_CLASS =
  "px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 first:pt-1";

type SidebarNavProps = {
  pathname: string | null;
  onNavigate?: () => void;
};

function SidebarNav({ pathname, onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label="Admin operations" className="flex flex-col">
      <div className="px-1.5 pb-1">
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
          <ul className="flex flex-col gap-0.5 px-1.5">
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

      <div className="mt-auto border-t border-zinc-200/80 px-2.5 py-3">
        <p className={SIDEBAR_GROUP_LABEL_CLASS}>Quick actions</p>
        <ul className="flex flex-col gap-1">
          {ADMIN_SIDEBAR_QUICK_ACTIONS.map((action) => (
            <li key={action.href}>
              <Link
                href={action.href}
                onClick={onNavigate}
                className="flex min-h-9 flex-col justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200/90 transition-colors hover:bg-zinc-50 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
              >
                <span>{action.label}</span>
                <span className="text-[10px] font-normal text-zinc-500">{action.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

type Props = {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  /** When true, mobile drawer is included (shell client mount or tests). */
  chromeMounted?: boolean;
};

export function AdminOperationsSidebar({
  mobileOpen,
  onMobileOpenChange,
  chromeMounted,
}: Props) {
  const pathname = usePathname();
  const menuId = useId();
  const clientMounted = useClientMounted();
  const mounted = chromeMounted ?? clientMounted;

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onMobileOpenChange(false);
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen, onMobileOpenChange]);

  return (
    <>
      <aside
        className="hidden w-[15.5rem] shrink-0 border-r border-zinc-200/80 bg-white lg:flex lg:flex-col"
        aria-label="Operations sidebar"
      >
        <div className="sticky top-[3.75rem] flex max-h-[calc(100vh-3.75rem)] flex-col overflow-y-auto px-2 py-3">
          <SidebarNav pathname={pathname} />
        </div>
      </aside>

      {mounted && mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-zinc-900/25 lg:hidden"
          aria-label="Close navigation menu"
          onClick={() => onMobileOpenChange(false)}
        />
      ) : null}

      {mounted ? (
        <aside
          id={menuId}
          className={`fixed bottom-0 left-0 top-[3.75rem] z-50 flex w-[min(18rem,88vw)] flex-col border-r border-zinc-200 bg-white shadow-lg transition-transform duration-200 lg:hidden ${
            mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
          }`}
          aria-label="Operations menu"
          aria-hidden={!mobileOpen}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Menu
            </span>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100"
              aria-label="Close navigation menu"
              onClick={() => onMobileOpenChange(false)}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-1 py-2">
            <SidebarNav pathname={pathname} onNavigate={() => onMobileOpenChange(false)} />
          </div>
        </aside>
      ) : null}
    </>
  );
}

export function AdminOperationsSidebarToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 lg:hidden"
      aria-expanded={open}
      aria-label={open ? "Close operations menu" : "Open operations menu"}
      onClick={onToggle}
    >
      {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
    </button>
  );
}
