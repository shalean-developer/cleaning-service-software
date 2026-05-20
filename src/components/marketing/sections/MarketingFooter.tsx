import Link from "next/link";
import {
  BUSINESS_HOURS,
  FOOTER_QUICK_LINKS,
  FOOTER_SUPPORT_LINKS,
  MARKETING_SERVICES,
  SHALEAN_CONTACT,
} from "@/features/marketing/constants";
import { IconWhatsApp } from "../icons";
import { MarketingButton } from "../MarketingButton";
import { MarketingContainer } from "../MarketingContainer";
import { ShaleanLogo } from "../ShaleanLogo";

export function MarketingFooter() {
  const whatsappUrl = `https://wa.me/${SHALEAN_CONTACT.whatsappNumber}`;
  const year = new Date().getFullYear();

  return (
    <footer id="contact" className="bg-shalean-navy text-slate-400">
      <MarketingContainer className="pt-[4.5rem] pb-12">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-5 lg:gap-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <ShaleanLogo variant="footer" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed">
              Premium home and office cleaning in Cape Town. Vetted professionals, easy online
              booking, and satisfaction guaranteed.
            </p>
            <div className="mt-6 flex gap-3" aria-label="Social media">
              {[
                { label: "Facebook", letter: "f" },
                { label: "Instagram", letter: "ig" },
                { label: "TikTok", letter: "t" },
                { label: "WhatsApp", letter: "w", href: whatsappUrl },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href ?? "#"}
                  target={social.href ? "_blank" : undefined}
                  rel={social.href ? "noopener noreferrer" : undefined}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white transition hover:bg-shalean-primary"
                  aria-label={social.label}
                >
                  {social.letter}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Services</h3>
            <ul className="mt-5 space-y-2.5">
              {MARKETING_SERVICES.map((item) => (
                <li key={item.slug}>
                  <Link href="#services" className="text-sm hover:text-white">
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Quick Links</h3>
            <ul className="mt-5 space-y-2.5">
              {FOOTER_QUICK_LINKS.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Help &amp; Support
            </h3>
            <ul className="mt-5 space-y-2.5">
              {FOOTER_SUPPORT_LINKS.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Contact Us</h3>
            <ul className="mt-5 space-y-3 text-sm">
              <li>
                <a href={`tel:${SHALEAN_CONTACT.phoneE164}`} className="hover:text-white">
                  {SHALEAN_CONTACT.phoneDisplay}
                </a>
              </li>
              <li>
                <a href={`mailto:${SHALEAN_CONTACT.email}`} className="hover:text-white">
                  {SHALEAN_CONTACT.email}
                </a>
              </li>
              <li>{SHALEAN_CONTACT.address}</li>
              <li>{BUSINESS_HOURS}</li>
            </ul>
            <MarketingButton
              href={whatsappUrl}
              external
              variant="secondary"
              className="mt-6 !rounded-[13px] !border-shalean-primary !bg-shalean-primary !text-white hover:!bg-blue-600"
            >
              <IconWhatsApp className="h-5 w-5" />
              WhatsApp Us
            </MarketingButton>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-center text-xs sm:flex-row sm:text-left">
          <p suppressHydrationWarning>
            © {year} Shalean Cleaning Services. All rights reserved.
          </p>
          <a href="#" className="hover:text-white">
            Back to top ↑
          </a>
        </div>
      </MarketingContainer>
    </footer>
  );
}
