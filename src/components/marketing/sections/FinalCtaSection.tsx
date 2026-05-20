import Image from "next/image";
import { MARKETING_IMAGES, SHALEAN_CONTACT } from "@/features/marketing/constants";
import { IconCheck, IconWhatsApp } from "../icons";
import { MarketingButton } from "../MarketingButton";

const TRUST_POINTS = [
  "Same-day service available",
  "Satisfaction guarantee",
  "Trusted, vetted cleaners",
] as const;

export function FinalCtaSection() {
  const whatsappUrl = `https://wa.me/${SHALEAN_CONTACT.whatsappNumber}?text=${encodeURIComponent("Hi Shalean, I'm ready to book a cleaning.")}`;

  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-shalean-primary via-blue-600 to-[#1d4ed8] shadow-2xl shadow-blue-500/30">
          <div className="grid lg:grid-cols-2">
            <div className="relative z-10 p-8 sm:p-12 lg:p-14">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Ready for a Cleaner Home?
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-blue-100">
                Book online in less than 2 minutes and let us take
                <br />
                care of the cleaning.
              </p>

              <ul className="mt-8 space-y-3">
                {TRUST_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-2 text-sm text-blue-50">
                    <IconCheck className="h-5 w-5 shrink-0 text-shalean-sky" />
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <MarketingButton
                  href="/sign-up?redirectedFrom=/customer/book"
                  variant="white"
                >
                  Book Now
                </MarketingButton>
                <MarketingButton href={whatsappUrl} variant="secondary" external>
                  <IconWhatsApp className="h-5 w-5 text-shalean-primary" />
                  WhatsApp Us
                </MarketingButton>
              </div>
            </div>

            <div className="relative hidden min-h-[16rem] lg:block">
              <Image
                src={MARKETING_IMAGES.finalCta}
                alt="Elegant clean living room"
                fill
                sizes="50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-shalean-primary/80 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
