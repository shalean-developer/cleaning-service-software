"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BOOKING_PATH, NAV_LINKS, SHALEAN_CONTACT } from "@/features/marketing/constants";
import { IconChevron, IconClose, IconMenu, IconPhone } from "./icons";
import { MarketingButton } from "./MarketingButton";
import { ShaleanLogo } from "./ShaleanLogo";

export function MarketingHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-shalean-border bg-white">
        <div className="marketing-container grid h-[4.75rem] grid-cols-[auto_1fr_auto] items-center gap-4 lg:h-20">
          <div className="min-w-0 shrink-0">
            <ShaleanLogo />
          </div>

          <nav
            className="hidden items-center justify-center gap-7 xl:flex"
            aria-label="Main navigation"
          >
            {NAV_LINKS.map((link) => {
              const isActive = link.href === "/" && pathname === "/";
              return (
                <div key={link.href} className="group relative">
                  <Link
                    href={link.href}
                    className={`flex items-center gap-1 text-[15px] font-medium transition hover:text-shalean-primary ${
                      isActive ? "text-shalean-primary" : "text-shalean-navy"
                    }`}
                  >
                    {link.label}
                    {"children" in link && link.children ? (
                      <IconChevron className="h-3.5 w-3.5 opacity-70" />
                    ) : null}
                  </Link>
                  {"children" in link && link.children ? (
                    <div className="invisible absolute left-1/2 top-full z-10 min-w-[12rem] -translate-x-1/2 rounded-xl border border-shalean-border bg-white py-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
                      {link.children.map((child) => (
                        <Link
                          key={child}
                          href={link.href}
                          className="block px-4 py-2 text-sm text-slate-600 hover:bg-shalean-soft-blue hover:text-shalean-primary"
                        >
                          {child}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="hidden items-center justify-end gap-5 lg:flex">
            <a
              href={`tel:${SHALEAN_CONTACT.phoneE164}`}
              className="flex items-center gap-2 whitespace-nowrap text-[15px] font-semibold text-shalean-navy"
            >
              <IconPhone className="h-4 w-4 text-shalean-primary" />
              {SHALEAN_CONTACT.phoneDisplay}
            </a>
            <MarketingButton
              href={BOOKING_PATH}
              className="!h-11 !min-w-[9.75rem] !rounded-xl !px-5 !text-[15px]"
            >
              Book a Cleaning
            </MarketingButton>
          </div>

          <button
            type="button"
            className="justify-self-end rounded-lg p-2 text-shalean-navy xl:hidden"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <IconClose className="h-6 w-6" /> : <IconMenu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-40 bg-shalean-navy/50 backdrop-blur-sm xl:hidden">
          <nav
            className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col gap-1 overflow-y-auto bg-white p-6 pt-24 shadow-2xl"
            aria-label="Mobile navigation"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl px-3 py-3 text-base font-medium text-shalean-navy hover:bg-shalean-soft-blue"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <a
              href={`tel:${SHALEAN_CONTACT.phoneE164}`}
              className="mt-4 flex items-center gap-2 px-3 py-3 font-semibold text-shalean-primary"
            >
              <IconPhone className="h-5 w-5" />
              {SHALEAN_CONTACT.phoneDisplay}
            </a>
            <MarketingButton href={BOOKING_PATH} className="mt-4 w-full !rounded-xl">
              Book a Cleaning
            </MarketingButton>
          </nav>
        </div>
      ) : null}
    </>
  );
}
