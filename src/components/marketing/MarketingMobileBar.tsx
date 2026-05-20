"use client";

import { SHALEAN_CONTACT } from "@/features/marketing/constants";
import { IconPhone, IconWhatsApp } from "./icons";
import { MarketingButton } from "./MarketingButton";

export function MarketingMobileBar() {
  const whatsappUrl = `https://wa.me/${SHALEAN_CONTACT.whatsappNumber}?text=${encodeURIComponent("Hi Shalean, I'd like to book a cleaning in Cape Town.")}`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-shalean-border bg-white/95 p-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
        <a
          href={`tel:${SHALEAN_CONTACT.phoneE164}`}
          className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-shalean-navy hover:bg-shalean-soft-blue"
        >
          <IconPhone className="h-5 w-5 text-shalean-primary" />
          Call
        </a>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold text-shalean-navy hover:bg-shalean-soft-blue"
        >
          <IconWhatsApp className="h-5 w-5 text-shalean-primary" />
          WhatsApp
        </a>
        <MarketingButton
          href="/sign-up?redirectedFrom=/customer/book"
          className="!rounded-xl !px-2 !py-2.5 !text-xs"
        >
          Book Now
        </MarketingButton>
      </div>
    </div>
  );
}
