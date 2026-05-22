"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CUSTOMER_HUB_NAV, type CustomerHubNavIcon } from "@/features/dashboards/customerHubNav";

const navItemClass =
  "flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shalean-primary focus-visible:ring-offset-2";

function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/customer") return pathname === "/customer";
  if (href === "/customer/bookings/recurring") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (href === "/customer/bookings") {
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) && !pathname.startsWith("/customer/bookings/recurring"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function HubNavIcon({ icon }: { icon: CustomerHubNavIcon }) {
  const className = "h-[18px] w-[18px] shrink-0";
  switch (icon) {
    case "home":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
        </svg>
      );
    case "bookings":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" d="M8 3v2m8-2v2M4 9h16M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
        </svg>
      );
    case "recurring":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v4h4M20 17v-4h-4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 11A7.5 7.5 0 0 1 17 7.5M17.5 13A7.5 7.5 0 0 1 7 16.5" />
        </svg>
      );
    case "book":
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" d="M12 5v14M5 12h14" />
        </svg>
      );
    default:
      return null;
  }
}

type Props = {
  accountLabel: string;
  showLiveBadge: boolean;
  footerSlot?: React.ReactNode;
  onNavigate?: () => void;
};

export function CustomerHubSidebar({
  accountLabel,
  showLiveBadge,
  footerSlot,
  onNavigate,
}: Props) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pb-5 pt-2">
        <Link
          href="/customer"
          onClick={onNavigate}
          className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shalean-primary focus-visible:ring-offset-2"
        >
          <span className="font-serif text-2xl font-medium tracking-tight text-shalean-navy">Shalean</span>
        </Link>
        <p className="mt-3 text-sm font-medium text-zinc-800">Your account</p>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{accountLabel}</p>
        {showLiveBadge ? (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            Live
          </span>
        ) : null}
      </div>

      <nav aria-label="Customer hub" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3">
        {CUSTOMER_HUB_NAV.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`${navItemClass} ${
                active
                  ? "bg-blue-50 text-shalean-primary"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <HubNavIcon icon={item.icon} />
              <span className="min-w-0 flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-zinc-200/80 px-4 py-4">
        {footerSlot}
        <Link
          href="/customer/book"
          onClick={onNavigate}
          className="mt-3 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-full bg-shalean-primary px-4 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.28)] transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shalean-primary focus-visible:ring-offset-2"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
          </svg>
          New visit
        </Link>
        <p className="mt-3 text-center text-xs font-medium text-zinc-400">Hub</p>
      </div>
    </div>
  );
}
