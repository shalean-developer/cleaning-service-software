"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  HEADER_PRIMARY_NAV,
  HEADER_SECONDARY_NAV,
  MARKETING_NAV_PATHS,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
  type HeaderNavLink,
} from "@/features/marketing/constants";
import { IconClose, IconMenu } from "./icons";
import { MarketingSectionOrRouteLink } from "./MarketingSectionLink";
import { ShaleanLogo } from "./ShaleanLogo";

function isNavLinkActive(href: string | undefined, pathname: string): boolean {
  if (!href) return false;
  if (href === "/") return pathname === "/";
  const pathOnly = href.split("?")[0] ?? href;
  return pathname === pathOnly;
}

const navLinkBase =
  "marketing-focus-ring relative inline-flex whitespace-nowrap px-0.5 py-2 text-[0.8125rem] font-medium tracking-[-0.01em] transition-colors duration-200 xl:text-[0.875rem] 2xl:text-[0.9375rem]";

const navLinkActive =
  "text-shalean-navy after:absolute after:inset-x-0 after:-bottom-px after:h-[2px] after:rounded-full after:bg-shalean-primary/75";

const navLinkIdle = "text-slate-600 hover:text-shalean-navy";

/** Progressive display so the center column never collides with utilities. */
function primaryNavVisibilityClass(label: string): string {
  if (label === "Apply") return "hidden xl:inline-flex";
  return "inline-flex";
}

type PlatformNavLinkProps = {
  link: HeaderNavLink;
  pathname: string;
  onNavigate?: () => void;
  className?: string;
  visibilityClass?: string;
};

function PlatformNavLink({
  link,
  pathname,
  onNavigate,
  className = "",
  visibilityClass = "inline-flex",
}: PlatformNavLinkProps) {
  const enabled = link.enabled !== false;
  const isActive = enabled && isNavLinkActive(link.href, pathname);
  const stateClass = isActive ? navLinkActive : navLinkIdle;
  const combinedClass = `${navLinkBase} ${visibilityClass} ${stateClass} ${className}`.trim();

  if (!enabled) {
    return (
      <span
        className={`${navLinkBase} ${visibilityClass} cursor-default text-slate-400 ${className}`.trim()}
        title="Coming soon"
      >
        {link.label}
      </span>
    );
  }

  return (
    <MarketingSectionOrRouteLink
      href={link.href}
      sectionId={link.sectionId}
      className={combinedClass}
      onNavigate={onNavigate}
    >
      {link.label}
    </MarketingSectionOrRouteLink>
  );
}

function UtilityLink({
  href,
  children,
  className = "",
  onNavigate,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      className={`marketing-focus-ring inline-flex shrink-0 rounded-lg px-2 py-2 text-sm transition-colors duration-200 ${className}`.trim()}
      onClick={onNavigate}
    >
      {children}
    </Link>
  );
}

const signUpButtonClass =
  "marketing-focus-ring inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-shalean-primary px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-600 sm:h-10 sm:px-6";

function SignUpButton({ onNavigate, className = "" }: { onNavigate?: () => void; className?: string }) {
  return (
    <Link href={SIGN_UP_PATH} className={`${signUpButtonClass} ${className}`.trim()} onClick={onNavigate}>
      Sign up
    </Link>
  );
}

export function MarketingHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuPanelRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuTitleId = useId();

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const firstLink = menuPanelRef.current?.querySelector<HTMLElement>("a, button");
    firstLink?.focus();

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, closeMenu]);

  return (
    <>
      <header
        className={`marketing-header fixed inset-x-0 top-0 z-50 ${scrolled ? "marketing-header--scrolled" : ""}`}
      >
        <div className="marketing-container grid h-[var(--marketing-header-height)] grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-4 lg:gap-6">
          <div className="min-w-0 justify-self-start">
            <ShaleanLogo />
          </div>

          <nav
            className="hidden min-w-0 items-center justify-center gap-5 justify-self-center lg:flex xl:gap-6 2xl:gap-8"
            aria-label="Main navigation"
          >
            {HEADER_PRIMARY_NAV.map((link) => (
              <PlatformNavLink
                key={link.label}
                link={link}
                pathname={pathname}
                visibilityClass={primaryNavVisibilityClass(link.label)}
              />
            ))}
          </nav>

          <div className="relative z-10 flex min-w-0 items-center justify-end justify-self-end gap-2 sm:gap-2.5 lg:gap-3">
            <div className="hidden shrink-0 items-center gap-2 lg:flex xl:hidden">
              <UtilityLink
                href={SIGN_IN_PATH}
                className="font-normal text-slate-600 hover:text-shalean-navy"
              >
                Log in
              </UtilityLink>
              <SignUpButton />
            </div>

            <div className="hidden shrink-0 items-center gap-2 xl:flex">
              <UtilityLink
                href={MARKETING_NAV_PATHS.faq}
                className="font-normal text-slate-500 hover:text-slate-700"
              >
                Help
              </UtilityLink>
              <span className="mx-1.5 h-4 w-px bg-slate-200/90" aria-hidden />
              <UtilityLink
                href={SIGN_IN_PATH}
                className="font-normal text-slate-600 hover:text-shalean-navy"
              >
                Log in
              </UtilityLink>
              <SignUpButton />
            </div>

            <button
              ref={menuButtonRef}
              type="button"
              className="marketing-focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-shalean-navy transition-colors hover:bg-slate-50 lg:hidden"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? menuTitleId : undefined}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <IconClose className="h-5 w-5" />
              ) : (
                <IconMenu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div
          className="fixed inset-0 z-40 bg-shalean-navy/15 backdrop-blur-[1px] lg:hidden"
          onClick={closeMenu}
          role="presentation"
        >
          <nav
            ref={menuPanelRef}
            id={menuTitleId}
            className="absolute right-0 top-0 flex h-full w-[min(100%,20rem)] flex-col border-l border-slate-100 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.08)]"
            aria-label="Mobile navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-[var(--marketing-header-height)] items-center justify-between gap-3 border-b border-slate-100 px-5">
              <ShaleanLogo />
              <button
                type="button"
                className="marketing-focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-shalean-navy hover:bg-slate-50"
                aria-label="Close menu"
                onClick={closeMenu}
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
              <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Platform
              </p>
              <div className="flex flex-col gap-0.5">
                {HEADER_PRIMARY_NAV.map((link) => (
                  <PlatformNavLink
                    key={link.label}
                    link={link}
                    pathname={pathname}
                    onNavigate={closeMenu}
                    visibilityClass="inline-flex"
                    className="px-1 py-3.5 text-[1.0625rem] after:-bottom-0.5"
                  />
                ))}
              </div>

              <div className="my-5 border-t border-slate-100" />

              <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                More
              </p>
              <div className="flex flex-col gap-0.5">
                {HEADER_SECONDARY_NAV.map((link) => (
                  <PlatformNavLink
                    key={link.label}
                    link={link}
                    pathname={pathname}
                    onNavigate={closeMenu}
                    visibilityClass="inline-flex"
                    className="px-1 py-3 text-base font-normal text-slate-600"
                  />
                ))}
              </div>

              <div className="my-5 border-t border-slate-100" />

              <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Account
              </p>
              <div className="flex flex-col gap-3">
                <UtilityLink
                  href={SIGN_IN_PATH}
                  onNavigate={closeMenu}
                  className="px-1 py-2 text-base font-normal text-slate-600 hover:text-shalean-navy"
                >
                  Log in
                </UtilityLink>
                <SignUpButton onNavigate={closeMenu} />
              </div>
            </div>
          </nav>
        </div>
      ) : null}
    </>
  );
}
