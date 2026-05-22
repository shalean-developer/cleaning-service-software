import Link from "next/link";
import type { ReactNode } from "react";
import {
  BUSINESS_HOURS,
  FOOTER_BRAND,
  FOOTER_LEGAL_LINKS,
  FOOTER_QUICK_LINKS,
  FOOTER_SUPPORT_LINKS,
  FOOTER_TRUST_POINTS,
  type FooterTrustPoint,
  SHALEAN_CONTACT,
  SHALEAN_SOCIAL,
} from "@/features/marketing/constants";
import type { MarketingSectionId } from "@/lib/ui/scrollToSection";
import { MarketingSectionLink } from "../MarketingSectionLink";
import {
  IconClock,
  IconFacebook,
  IconInstagram,
  IconLinkedIn,
  IconMail,
  IconMapPin,
  IconPhone,
  IconShield,
  IconSparkle,
  IconWhatsApp,
} from "../icons";
import { MarketingContainer } from "../MarketingContainer";
import { ShaleanLogo } from "../ShaleanLogo";

const TRUST_ICONS: Record<FooterTrustPoint["icon"], typeof IconShield> = {
  shield: IconShield,
  map: IconMapPin,
  clock: IconClock,
  sparkle: IconSparkle,
};

function FooterColumnHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
      {children}
    </h3>
  );
}

const footerLinkClass =
  "marketing-focus-ring marketing-footer-link text-[0.9375rem] leading-relaxed";

function FooterSectionLink({
  sectionId,
  children,
}: {
  sectionId: MarketingSectionId;
  children: ReactNode;
}) {
  return (
    <MarketingSectionLink sectionId={sectionId} className={footerLinkClass}>
      {children}
    </MarketingSectionLink>
  );
}

function FooterExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
      {children}
    </a>
  );
}

function TrustPill({ point }: { point: FooterTrustPoint }) {
  const Icon = TRUST_ICONS[point.icon];

  return (
    <li className="marketing-footer-trust-pill inline-flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[0.8125rem] font-medium leading-snug text-slate-200">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-sky-300/90 ring-1 ring-blue-400/20">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      {point.label}
    </li>
  );
}

function SocialButton({
  href,
  label,
  children,
  disabled,
}: {
  href?: string;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const base =
    "marketing-footer-social marketing-focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-300";

  if (disabled || !href) {
    return (
      <span
        className={`${base} cursor-default opacity-40`}
        aria-label={`${label}, coming soon`}
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} text-white hover:text-white`}
      aria-label={label}
    >
      {children}
    </a>
  );
}

export function MarketingFooter() {
  const whatsappUrl = `https://wa.me/${SHALEAN_CONTACT.whatsappNumber}`;
  const year = new Date().getFullYear();

  return (
    <footer
      id="contact"
      className="marketing-footer-surface relative overflow-hidden text-[#94A3B8]"
      aria-labelledby="footer-heading"
    >
      <h2 id="footer-heading" className="sr-only">
        Shalean Cleaning Services. site footer
      </h2>

      <div className="marketing-footer-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="marketing-footer-grain pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
        aria-hidden
      />

      {/* Trust bar */}
      <MarketingContainer className="relative pt-16 pb-4 sm:pt-20 sm:pb-6">
        <ul
          className="flex flex-wrap justify-center gap-2.5 sm:justify-start sm:gap-3"
          aria-label="Trust and service guarantees"
        >
          {FOOTER_TRUST_POINTS.map((point) => (
            <TrustPill key={point.id} point={point} />
          ))}
        </ul>
      </MarketingContainer>

      {/* Main footer content */}
      <MarketingContainer className="relative pb-16 sm:pb-20 lg:pb-24">
        <div className="grid gap-14 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-14 lg:grid-cols-5 lg:gap-x-12 lg:gap-y-0">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <ShaleanLogo variant="footer" />
            <p className="mt-6 max-w-[20rem] text-[0.9375rem] leading-[1.75] text-[#F8FAFC]/90">
              {FOOTER_BRAND.description}
            </p>

            <nav className="mt-8 flex items-center gap-3" aria-label="Social media">
              <SocialButton href={whatsappUrl} label="WhatsApp Shalean Cleaning Services">
                <IconWhatsApp className="h-[1.125rem] w-[1.125rem]" />
              </SocialButton>
              <SocialButton
                href={SHALEAN_SOCIAL.facebook}
                label="Shalean Cleaning Services on Facebook"
              >
                <IconFacebook className="h-[1.125rem] w-[1.125rem]" />
              </SocialButton>
              <SocialButton
                href={SHALEAN_SOCIAL.instagram}
                label="Shalean Cleaning Services on Instagram"
              >
                <IconInstagram className="h-[1.125rem] w-[1.125rem]" />
              </SocialButton>
              <SocialButton
                href={SHALEAN_SOCIAL.linkedIn}
                label="Shalean Cleaning Services on LinkedIn"
              >
                <IconLinkedIn className="h-[1.125rem] w-[1.125rem]" />
              </SocialButton>
            </nav>
          </div>

          {/* Quick links */}
          <nav aria-labelledby="footer-quick-links-heading">
            <FooterColumnHeading>
              <span id="footer-quick-links-heading">Quick Links</span>
            </FooterColumnHeading>
            <ul className="mt-5 space-y-3.5">
              {FOOTER_QUICK_LINKS.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className={footerLinkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-labelledby="footer-legal-heading">
            <FooterColumnHeading>
              <span id="footer-legal-heading">Legal</span>
            </FooterColumnHeading>
            <ul className="mt-5 space-y-3.5">
              {FOOTER_LEGAL_LINKS.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className={footerLinkClass}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Help & support */}
          <nav aria-labelledby="footer-support-heading">
            <FooterColumnHeading>
              <span id="footer-support-heading">Help &amp; Support</span>
            </FooterColumnHeading>
            <ul className="mt-5 space-y-3.5">
              {FOOTER_SUPPORT_LINKS.map((item) =>
                item.sectionId ? (
                  <li key={item.label}>
                    <FooterSectionLink sectionId={item.sectionId}>{item.label}</FooterSectionLink>
                  </li>
                ) : item.href ? (
                  <li key={item.label}>
                    <Link href={item.href} className={footerLinkClass}>
                      {item.label}
                    </Link>
                  </li>
                ) : (
                  <li key={item.label} className="text-[0.9375rem] leading-relaxed text-slate-500">
                    {item.label}
                  </li>
                ),
              )}
            </ul>
          </nav>

          {/* Contact */}
          <div aria-labelledby="footer-contact-heading">
            <FooterColumnHeading>
              <span id="footer-contact-heading">Contact</span>
            </FooterColumnHeading>
            <ul className="mt-5 space-y-4 text-[0.9375rem] leading-relaxed">
              <li className="flex items-start gap-3">
                <IconPhone
                  className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                  aria-hidden
                />
                <a
                  href={`tel:${SHALEAN_CONTACT.phoneE164}`}
                  className="marketing-focus-ring marketing-footer-link font-medium text-slate-200"
                >
                  {SHALEAN_CONTACT.phoneDisplay}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <IconMail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                <a
                  href={`mailto:${SHALEAN_CONTACT.email}`}
                  className="marketing-focus-ring marketing-footer-link"
                >
                  {SHALEAN_CONTACT.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <IconMapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                  aria-hidden
                />
                <span className="text-slate-400">{SHALEAN_CONTACT.address}</span>
              </li>
              <li className="flex items-start gap-3">
                <IconClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                <span className="text-slate-500">{BUSINESS_HOURS}</span>
              </li>
            </ul>
          </div>
        </div>
      </MarketingContainer>

      {/* Bottom legal bar */}
      <div className="relative border-t border-white/[0.08]">
        <MarketingContainer className="py-8 sm:py-10">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p
              className="text-[0.8125rem] leading-relaxed text-slate-500"
              suppressHydrationWarning
            >
              © {year} Shalean Cleaning Services. All rights reserved.
            </p>

            <nav
              className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.8125rem]"
              aria-label="Footer utilities"
            >
              <MarketingSectionLink
                sectionId="main-content"
                className="marketing-focus-ring marketing-footer-link font-medium text-slate-400 hover:text-slate-200"
                aria-label="Back to top of page"
              >
                Back to top
              </MarketingSectionLink>
            </nav>

            <p className="text-[0.75rem] tracking-wide text-slate-600">
              Built in Cape Town
            </p>
          </div>
        </MarketingContainer>
      </div>
    </footer>
  );
}
