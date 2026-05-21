import type { Metadata } from "next";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { MarketingBookCta } from "@/components/marketing/MarketingBookCta";
import { MarketingInternalLinks } from "@/components/marketing/MarketingInternalLinks";
import { MarketingSeoPageLayout } from "@/components/marketing/MarketingSeoPageLayout";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { IconClock, IconMail, IconMapPin, IconPhone, IconWhatsApp } from "@/components/marketing/icons";
import { BUSINESS_HOURS, SHALEAN_CONTACT } from "@/features/marketing/constants";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import { CONTACT_PAGE_PATH } from "@/features/marketing/seo-pages";
import {
  buildBreadcrumbSchema,
  buildJsonLdGraph,
  buildLocalBusinessSchema,
} from "@/features/marketing/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Contact Shalean Cleaning Services Cape Town",
  description:
    "Contact Shalean for home and office cleaning in Cape Town. Phone, email, WhatsApp, and online booking available Mon–Sat.",
  path: CONTACT_PAGE_PATH,
});

export default function ContactPage() {
  const whatsappUrl = `https://wa.me/${SHALEAN_CONTACT.whatsappNumber}`;
  const schema = buildJsonLdGraph([
    buildLocalBusinessSchema(),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Contact", path: CONTACT_PAGE_PATH },
    ]),
  ]);

  return (
    <MarketingSeoShell>
      <JsonLdScript data={schema} />
      <MarketingSeoPageLayout
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Contact" },
        ]}
        h1="Contact Shalean Cleaning Services"
        intro="Reach our Cape Town team for booking help, quotes, or service questions. Prefer self-service? Book online in minutes."
      >
        <div className="mx-auto max-w-3xl">
          <section aria-labelledby="contact-details-heading">
            <h2
              id="contact-details-heading"
              className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl"
            >
              Get in touch
            </h2>
            <ul className="mt-6 space-y-5 text-base text-slate-600">
              <li className="flex items-start gap-3">
                <IconPhone className="mt-1 h-5 w-5 shrink-0 text-shalean-primary" aria-hidden />
                <div>
                  <p className="font-medium text-shalean-navy">Phone</p>
                  <a
                    href={`tel:${SHALEAN_CONTACT.phoneE164}`}
                    className="marketing-focus-ring text-shalean-primary hover:underline"
                  >
                    {SHALEAN_CONTACT.phoneDisplay}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <IconMail className="mt-1 h-5 w-5 shrink-0 text-shalean-primary" aria-hidden />
                <div>
                  <p className="font-medium text-shalean-navy">Email</p>
                  <a
                    href={`mailto:${SHALEAN_CONTACT.email}`}
                    className="marketing-focus-ring text-shalean-primary hover:underline"
                  >
                    {SHALEAN_CONTACT.email}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <IconMapPin className="mt-1 h-5 w-5 shrink-0 text-shalean-primary" aria-hidden />
                <div>
                  <p className="font-medium text-shalean-navy">Service area</p>
                  <p>Cape Town metro and surrounding suburbs</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <IconClock className="mt-1 h-5 w-5 shrink-0 text-shalean-primary" aria-hidden />
                <div>
                  <p className="font-medium text-shalean-navy">Operating hours</p>
                  <p>{BUSINESS_HOURS}</p>
                </div>
              </li>
            </ul>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="marketing-focus-ring mt-8 inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full bg-[#25D366] px-8 text-sm font-semibold text-white transition hover:bg-[#1fb855]"
            >
              <IconWhatsApp className="h-5 w-5" aria-hidden />
              Chat on WhatsApp
            </a>
          </section>

          <section className="mt-12" aria-labelledby="contact-book-heading">
            <h2
              id="contact-book-heading"
              className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl"
            >
              Book online
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              The fastest way to schedule cleaning is through our secure booking flow — instant
              quotes, vetted cleaners, and encrypted payment.
            </p>
            <div className="mt-6">
              <MarketingBookCta />
            </div>
          </section>
        </div>

        <MarketingInternalLinks />
      </MarketingSeoPageLayout>
    </MarketingSeoShell>
  );
}
