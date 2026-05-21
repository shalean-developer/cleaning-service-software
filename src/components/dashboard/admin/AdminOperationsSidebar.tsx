"use client";

import { useEffect, useId } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/dashboard/admin/overview/AdminSidebar";
import { useClientMounted } from "@/lib/react/useClientMounted";

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

  const desktopSidebarClass =
    "hidden w-[17rem] shrink-0 lg:flex lg:flex-col lg:px-3 lg:py-4";

  const sidebarPanelClass =
    "flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_4px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm";

  return (
    <>
      <aside className={desktopSidebarClass} aria-label="Operations sidebar">
        <div className="sticky top-[4.25rem] flex max-h-[calc(100vh-4.25rem)] min-h-0 flex-1 flex-col">
          <div className={sidebarPanelClass}>
            <AdminSidebar pathname={pathname} />
          </div>
        </div>
      </aside>

      {mounted && mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px] lg:hidden"
          aria-label="Close navigation menu"
          onClick={() => onMobileOpenChange(false)}
        />
      ) : null}

      {mounted ? (
        <aside
          id={menuId}
          className={`fixed bottom-0 left-0 top-[3.75rem] z-50 flex w-[min(19rem,90vw)] flex-col px-3 py-3 transition-transform duration-200 lg:hidden ${
            mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
          }`}
          aria-label="Operations menu"
          aria-hidden={!mobileOpen}
        >
          <div className={`${sidebarPanelClass} shadow-xl`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Menu
              </span>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                aria-label="Close navigation menu"
                onClick={() => onMobileOpenChange(false)}
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <AdminSidebar pathname={pathname} onNavigate={() => onMobileOpenChange(false)} />
            </div>
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
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 lg:hidden"
      aria-expanded={open}
      aria-label={open ? "Close operations menu" : "Open operations menu"}
      onClick={onToggle}
    >
      {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
    </button>
  );
}
