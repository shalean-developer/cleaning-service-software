import { BOOKING_PATH, marketingBookPath } from "@/features/marketing/constants";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { MarketingButton } from "./MarketingButton";

type MarketingBookCtaProps = {
  serviceSlug?: ServiceSlug;
  label?: string;
};

export function MarketingBookCta({
  serviceSlug,
  label = "Book Online",
}: MarketingBookCtaProps) {
  const href = serviceSlug ? marketingBookPath(serviceSlug) : BOOKING_PATH;
  const bookLabel = serviceSlug
    ? `Book ${label === "Book Online" ? "cleaning" : label} online in Cape Town`
    : "Book Shalean cleaning services online in Cape Town";

  return (
    <div className="flex flex-wrap gap-4">
      <MarketingButton href={href} aria-label={bookLabel}>
        {label}
      </MarketingButton>
      <MarketingButton
        href={BOOKING_PATH}
        variant="secondary"
        aria-label="Get an instant cleaning quote in Cape Town"
      >
        Get a quote
      </MarketingButton>
    </div>
  );
}
